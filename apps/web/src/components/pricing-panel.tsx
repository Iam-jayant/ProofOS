"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { fetchOracleRates } from "@/lib/api";
import { IconCurrencyDollar, IconCurrencyRupee, IconInfoCircle, IconRefresh } from "@tabler/icons-react";

const DEFAULT_USD_INR = "83.00";
const ORACLE_REFRESH_MS = 30_000;

export function PricingPanel() {
  const { session, setPrices, setUsdInrRate } = useSession();
  const [localUsdInr, setLocalUsdInr] = useState(session.usdInrRate || DEFAULT_USD_INR);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleError, setOracleError] = useState<string | null>(null);
  const [lastOracleUpdate, setLastOracleUpdate] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Get unique assets from ledger
  const uniqueAssets = useMemo(
    () => [...new Set(session.ledger.map((row) => row.asset))],
    [session.ledger]
  );
  const priceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of session.prices) {
      map[entry.asset] = entry.usdPrice;
    }
    return map;
  }, [session.prices]);

  const priceMapRef = useRef<Record<string, string>>({});
  useEffect(() => {
    priceMapRef.current = priceMap;
  }, [priceMap]);

  const syncOraclePrices = useCallback(
    async (showSpinner: boolean) => {
      if (uniqueAssets.length === 0) return;

      if (showSpinner) setOracleLoading(true);
      try {
        const oracle = await fetchOracleRates(uniqueAssets);
        const currentPrices = priceMapRef.current;

        const merged = new Map<string, string>();
        for (const asset of uniqueAssets) {
          merged.set(asset, currentPrices[asset] ?? "");
        }
        for (const [asset, usdPrice] of Object.entries(oracle.asset_usd_prices)) {
          merged.set(asset, usdPrice);
        }

        setPrices(
          Array.from(merged.entries()).map(([asset, usdPrice]) => ({
            asset,
            usdPrice,
          })),
        );

        const nextUsdInr = oracle.usd_inr.toFixed(4);
        setLocalUsdInr(nextUsdInr);
        setUsdInrRate(nextUsdInr);
        setLastOracleUpdate(oracle.updated_at);

        if (oracle.unsupported_assets.length > 0) {
          setOracleError(`Oracle unavailable for: ${oracle.unsupported_assets.join(", ")}`);
        } else {
          setOracleError(null);
        }
      } catch (err) {
        setOracleError(err instanceof Error ? err.message : "Failed to sync oracle rates");
      } finally {
        if (showSpinner) setOracleLoading(false);
      }
    },
    [setPrices, setUsdInrRate, uniqueAssets],
  );

  useEffect(() => {
    if (uniqueAssets.length === 0) return;

    void syncOraclePrices(true);

    if (!autoRefreshEnabled) return;

    const id = setInterval(() => {
      void syncOraclePrices(false);
    }, ORACLE_REFRESH_MS);

    return () => clearInterval(id);
  }, [autoRefreshEnabled, syncOraclePrices, uniqueAssets.length]);

  const parsedUsdInr = parseFloat(localUsdInr) || 0;

  const handlePriceChange = (asset: string, value: string) => {
    // Allow only valid decimal numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const updated = { ...priceMap, [asset]: value };
      const priceEntries = Object.entries(updated).map(([a, usdPrice]) => ({
        asset: a,
        usdPrice,
      }));
      setPrices(priceEntries);
      setAutoRefreshEnabled(false);
    }
  };

  const handleUsdInrChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setLocalUsdInr(value);
      setUsdInrRate(value);
      setAutoRefreshEnabled(false);
    }
  };

  if (uniqueAssets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-200">Pricing Inputs</h3>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <IconInfoCircle className="w-3.5 h-3.5" />
          <span>Oracle-backed live rates</span>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/60">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="text-xs text-neutral-400">
            Source: <span className="text-neutral-300">Coinbase Oracle Feed</span>
            {lastOracleUpdate && (
              <span className="ml-2 text-neutral-500">
                Updated {new Date(lastOracleUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800"
              />
              Auto refresh (30s)
            </label>
            <button
              onClick={() => void syncOraclePrices(true)}
              disabled={oracleLoading}
              className="px-2.5 py-1.5 rounded-md bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700/50 text-xs text-white flex items-center gap-1.5"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${oracleLoading ? "animate-spin" : ""}`} />
              Refresh Now
            </button>
          </div>
        </div>
        {oracleError && <p className="text-xs text-amber-400 mt-2">{oracleError}</p>}
      </div>

      {/* USD/INR Rate */}
      <div className="mb-6 p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <IconCurrencyDollar className="w-4 h-4 text-green-400" />
              <span className="text-neutral-300 text-sm">USD</span>
            </div>
            <span className="text-neutral-500">→</span>
            <div className="flex items-center gap-1">
              <IconCurrencyRupee className="w-4 h-4 text-orange-400" />
              <span className="text-neutral-300 text-sm">INR</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-sm">1 USD =</span>
            <input
              type="text"
              value={localUsdInr}
              onChange={(e) => handleUsdInrChange(e.target.value)}
              className="w-24 px-3 py-1.5 bg-neutral-900 border border-neutral-600 rounded text-right text-neutral-200 text-sm font-mono focus:outline-none focus:border-neutral-500"
            />
            <span className="text-neutral-500 text-sm">INR</span>
          </div>
        </div>
      </div>

      {/* Asset Prices */}
      <div className="space-y-2">
        <p className="text-sm text-neutral-400 mb-3">Asset Prices (USD and INR)</p>
        {uniqueAssets.map((asset) => (
          <div
            key={asset}
            className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-neutral-200 font-medium">{asset}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-sm">$</span>
              <input
                type="text"
                value={priceMap[asset] || ""}
                onChange={(e) => handlePriceChange(asset, e.target.value)}
                placeholder="0.00"
                className="w-28 px-3 py-1.5 bg-neutral-900 border border-neutral-600 rounded text-right text-neutral-200 text-sm font-mono focus:outline-none focus:border-neutral-500"
              />
              <span className="text-neutral-500 text-sm">USD</span>
              <span className="text-neutral-600">|</span>
              <span className="min-w-28 text-right text-xs font-mono text-emerald-300">
                {(() => {
                  const usd = parseFloat(priceMap[asset] || "0");
                  if (!usd || !parsedUsdInr) return "INR -";
                  return new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(usd * parsedUsdInr);
                })()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
