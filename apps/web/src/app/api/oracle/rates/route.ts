import { NextRequest, NextResponse } from "next/server";

const COINBASE_EXCHANGE_RATES_URL = "https://api.coinbase.com/v2/exchange-rates?currency=USD";

interface CoinbaseRatesResponse {
  data?: {
    rates?: Record<string, string>;
  };
}

function normalizeOracleSymbol(asset: string): string | null {
  const upper = asset.trim().toUpperCase();
  if (!upper) return null;

  const compact = upper.replace(/[^A-Z0-9]/g, "");
  if (!compact) return null;

  if (compact === "WETH") return "ETH";
  if (compact === "WBTC") return "BTC";
  if (compact.startsWith("USDC")) return "USDC";
  if (compact.startsWith("USDT")) return "USDT";

  if (/^[A-Z0-9]{2,10}$/.test(compact)) return compact;
  return null;
}

function formatOraclePrice(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;

  const fixed = value >= 1 ? value.toFixed(6) : value.toFixed(10);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export async function GET(req: NextRequest) {
  const assetsParam = req.nextUrl.searchParams.get("assets") ?? "";
  const rawAssets = assetsParam
    .split(",")
    .map((asset) => decodeURIComponent(asset).trim())
    .filter((asset) => asset.length > 0)
    .slice(0, 50);

  if (rawAssets.length === 0) {
    return NextResponse.json({ error: "assets query parameter is required" }, { status: 400 });
  }

  try {
    const ratesRes = await fetch(COINBASE_EXCHANGE_RATES_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!ratesRes.ok) {
      return NextResponse.json(
        { error: `Oracle upstream returned HTTP ${ratesRes.status}` },
        { status: 502 },
      );
    }

    const payload = (await ratesRes.json()) as CoinbaseRatesResponse;
    const rates = payload.data?.rates;
    if (!rates) {
      return NextResponse.json({ error: "Oracle response missing rates" }, { status: 502 });
    }

    const usdInr = Number(rates.INR);
    if (!Number.isFinite(usdInr) || usdInr <= 0) {
      return NextResponse.json({ error: "Oracle response missing USD/INR rate" }, { status: 502 });
    }

    const assetUsdPrices: Record<string, string> = {};
    const unsupportedAssets: string[] = [];

    for (const asset of rawAssets) {
      const symbol = normalizeOracleSymbol(asset);
      if (!symbol) {
        unsupportedAssets.push(asset);
        continue;
      }

      if (symbol === "USD") {
        assetUsdPrices[asset] = "1";
        continue;
      }

      const usdToSymbolRaw = rates[symbol];
      const usdToSymbol = Number(usdToSymbolRaw);
      if (!usdToSymbolRaw || !Number.isFinite(usdToSymbol) || usdToSymbol <= 0) {
        unsupportedAssets.push(asset);
        continue;
      }

      const symbolToUsd = 1 / usdToSymbol;
      const formatted = formatOraclePrice(symbolToUsd);
      if (!formatted) {
        unsupportedAssets.push(asset);
        continue;
      }

      assetUsdPrices[asset] = formatted;
    }

    return NextResponse.json({
      source: "coinbase-exchange-rates",
      usd_inr: usdInr,
      asset_usd_prices: assetUsdPrices,
      unsupported_assets: unsupportedAssets,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch oracle rates",
      },
      { status: 502 },
    );
  }
}