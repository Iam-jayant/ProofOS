// Port of crates/api/src/alchemy.rs → crates/api/src/main.rs get_transfers handler
// Exact same logic: fetch incoming + outgoing, normalize, sort by block_time, categorize

import { NextRequest, NextResponse } from "next/server";
import { categorizeLedger, type LedgerRow } from "@/lib/tax";

const ALCHEMY_BASE_SEPOLIA_URL =
  process.env.ALCHEMY_BASE_SEPOLIA_URL ??
  `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

// ─── Alchemy API types ───────────────────────────────────────────────────────

interface AlchemyTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  metadata?: { blockTimestamp?: string };
}

interface AlchemyResult {
  transfers: AlchemyTransfer[];
}

interface JsonRpcResponse {
  result?: AlchemyResult;
  error?: { message: string };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTimestamp(iso: string): number {
  // Alchemy returns ISO 8601 e.g. "2024-01-15T10:30:00.000Z" — same as chrono in Rust
  const ms = Date.parse(iso);
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

async function fetchTransfers(
  fromAddress: string | null,
  toAddress: string | null,
): Promise<AlchemyTransfer[]> {
  const url = ALCHEMY_BASE_SEPOLIA_URL;

  const params: Record<string, unknown> = {
    fromBlock: "0x0",
    toBlock: "latest",
    category: ["external", "erc20", "erc721", "erc1155"],
    withMetadata: true,
    maxCount: "0x3e8", // 1000 — same as Rust
  };
  if (fromAddress) params.fromAddress = fromAddress;
  if (toAddress) params.toAddress = toAddress;

  const body = {
    id: 1,
    jsonrpc: "2.0",
    method: "alchemy_getAssetTransfers",
    params: [params],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);

  const json: JsonRpcResponse = await res.json();
  if (json.error) throw new Error(`Alchemy API error: ${json.error.message}`);
  return json.result?.transfers ?? [];
}

function normalizeTransfer(
  transfer: AlchemyTransfer,
  ownerWallet: string,
  direction: "in" | "out",
): LedgerRow | null {
  const value = transfer.value ?? 0;
  if (value === 0) return null; // matches Rust: if value == 0.0 { return None; }

  const blockTime = transfer.metadata?.blockTimestamp
    ? parseTimestamp(transfer.metadata.blockTimestamp)
    : 0;

  // Determine asset and decimals — same logic as Rust normalize_transfer
  let asset: string;
  let decimals: number;
  if (transfer.category === "external") {
    asset = "ETH";
    decimals = 18;
  } else {
    asset = transfer.asset ?? "UNKNOWN";
    decimals = 18; // default to 18 (same as Rust comment)
  }

  // Counterparty: in = from, out = to
  const counterparty =
    direction === "in" ? transfer.from : (transfer.to ?? null);

  return {
    chain_id: 84532, // Base Sepolia
    owner_wallet: ownerWallet.toLowerCase(),
    tx_hash: transfer.hash,
    block_time: blockTime,
    asset,
    amount: value.toString(),
    decimals,
    direction,
    counterparty,
    category: "unknown", // will be overwritten by categorizeLedger
    confidence: 0.0,
    user_override: false,
  };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { wallets?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wallets = body.wallets;
  if (!Array.isArray(wallets) || wallets.length === 0) {
    return NextResponse.json({ error: "No wallets provided" }, { status: 400 });
  }

  const walletList: string[] = wallets.map((w) => String(w));

  let allLedger: LedgerRow[] = [];
  const walletCounts: { wallet: string; count: number }[] = [];

  for (const wallet of walletList) {
    try {
      const incoming = await fetchTransfers(null, wallet);
      const outgoing = await fetchTransfers(wallet, null);

      const rows: LedgerRow[] = [];
      for (const t of incoming) {
        const row = normalizeTransfer(t, wallet, "in");
        if (row) rows.push(row);
      }
      for (const t of outgoing) {
        const row = normalizeTransfer(t, wallet, "out");
        if (row) rows.push(row);
      }

      // Sort by block_time ascending (same as Rust ledger.sort_by)
      rows.sort((a, b) => a.block_time - b.block_time);

      walletCounts.push({ wallet, count: rows.length });
      allLedger = allLedger.concat(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Failed to fetch transfers for ${wallet}: ${msg}` },
        { status: 500 },
      );
    }
  }

  // Sort combined ledger by block_time (same as Rust all_ledger.sort_by)
  allLedger.sort((a, b) => a.block_time - b.block_time);

  // Categorize transactions based on heuristics (same as Rust categorize_ledger call)
  const categorized = categorizeLedger(allLedger, walletList);

  return NextResponse.json({ ledger: categorized, wallet_counts: walletCounts });
}
