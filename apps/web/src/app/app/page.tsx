"use client";

import { useState } from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import { SessionManager } from "@/components/session-manager";
import { Wizard } from "@/components/wizard";
import { LedgerTable } from "@/components/ledger-table";
import { PricingPanel } from "@/components/pricing-panel";
import { TaxPanel } from "@/components/tax-panel";
import { useSession, type LedgerRow } from "@/lib/session";
import { fetchTransfers, type ApiLedgerRow } from "@/lib/api";
import {
  IconHome,
  IconApps,
  IconShieldCheck,
  IconCheck,
  IconRefresh,
  IconLoader2,
  IconAlertCircle,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";

const dockItems = [
  {
    title: "Home",
    icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/",
  },
  {
    title: "App",
    icon: <IconApps className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/app",
  },
  {
    title: "Club",
    icon: <IconUsers className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/club",
  },
  {
    title: "Verify",
    icon: <IconShieldCheck className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/verify",
  },
];

// Convert API response to session LedgerRow format
function convertApiLedger(apiRows: ApiLedgerRow[]): LedgerRow[] {
  return apiRows.map((row, index) => ({
    id: `${row.tx_hash}-${row.direction}-${row.asset}-${index}`,
    chainId: row.chain_id,
    ownerWallet: row.owner_wallet,
    txHash: row.tx_hash,
    blockTime: row.block_time,
    asset: row.asset,
    amount: row.amount,
    decimals: row.decimals,
    direction: row.direction,
    counterparty: row.counterparty ?? undefined,
    category: row.category,
    confidence: row.confidence,
    userOverride: row.user_override,
    costBasisInr: row.cost_basis_inr,
  }));
}

function SetupComplete() {
  const { session, resetSession, setLedger, setUse44ada } = useSession();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);

  const userTypeLabels = {
    individual: "Individual",
    huf: "HUF",
    corporate: "Corporate",
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setLastSyncCount(null);

    try {
      const walletAddresses = session.wallets.map((w) => w.address);
      const response = await fetchTransfers(walletAddresses);
      const ledgerRows = convertApiLedger(response.ledger);
      setLedger(ledgerRows);
      setLastSyncCount(ledgerRows.length);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-green-900/50 bg-green-950/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <IconCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-200">Setup Complete</h2>
            <p className="text-sm text-neutral-500">Your session is ready for analysis</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Entity Type</p>
            <p className="text-neutral-200 font-medium">
              {session.userType ? userTypeLabels[session.userType] : "Not set"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Wallets</p>
            <p className="text-neutral-200 font-medium">
              {session.wallets.length} wallet{session.wallets.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Transactions</p>
            <p className="text-neutral-200 font-medium">
              {session.ledger.length} synced
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-neutral-800/50">
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Start over?</span>
              <button
                onClick={() => {
                  resetSession();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-950 border border-red-800 rounded-lg transition-colors"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <IconRefresh className="w-4 h-4" />
              Start Over
            </button>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white transition-colors flex items-center gap-2"
          >
            {syncing ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <IconRefresh className="w-4 h-4" />
                Sync Transactions
              </>
            )}
          </button>
        </div>

        {/* Sync feedback */}
        {syncError && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/50 flex items-center gap-2 text-red-400 text-sm">
            <IconAlertCircle className="w-4 h-4 shrink-0" />
            {syncError}
          </div>
        )}
        {lastSyncCount !== null && !syncError && (
          <div className="mt-4 p-3 rounded-lg bg-green-950/50 border border-green-800/50 text-green-400 text-sm">
            Successfully synced {lastSyncCount} transaction{lastSyncCount !== 1 ? "s" : ""} from Sepolia
          </div>
        )}
      </div>

      {/* Ledger table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-lg font-semibold text-neutral-200 mb-4">Transaction Ledger</h3>
        <LedgerTable />
      </div>

      {/* Pricing panel (when transactions exist) */}
      {session.ledger.length > 0 && <PricingPanel />}

      {/* 44ADA Toggle (Individual only) */}
      {session.ledger.length > 0 && session.userType === "individual" && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-200">Section 44ADA</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Presumptive taxation for professionals — pay tax on 50% of gross receipts
              </p>
            </div>
            <button
              onClick={() => setUse44ada(!session.use44ada)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                session.use44ada ? "bg-purple-600" : "bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  session.use44ada ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Tax calculation panel */}
      {session.ledger.length > 0 && <TaxPanel />}

      {/* Next steps (when ledger is empty) */}
      {session.ledger.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 className="text-lg font-semibold text-neutral-200 mb-4">Next Steps</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-mono">
                1
              </div>
              <span className="text-neutral-300">Click &quot;Sync Transactions&quot; to fetch on-chain activity</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
              <div className="w-6 h-6 rounded-full bg-neutral-700/50 text-neutral-500 flex items-center justify-center text-xs font-mono">
                2
              </div>
              <span className="text-neutral-500">Review & categorize transactions</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
              <div className="w-6 h-6 rounded-full bg-neutral-700/50 text-neutral-500 flex items-center justify-center text-xs font-mono">
                3
              </div>
              <span className="text-neutral-500">Calculate tax & generate proof</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppPage() {
  const { session, isLoaded } = useSession();
  const [wizardComplete, setWizardComplete] = useState(false);

  // Show wizard only if not explicitly completed
  const hasSetup = Boolean(session.userType) && session.wallets.length > 0;
  const showWizard = !wizardComplete && !hasSetup;

  return (
    <div className="min-h-screen w-full bg-black/96 antialiased relative">
      {/* Floating dock navigation */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <FloatingDock items={dockItems} />
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-16 pb-32">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white">ProofOS</h1>
          <Link
            href="/"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Session manager */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-xs text-neutral-500">
            {isLoaded && (
              <>
                {session.wallets.length} wallet{session.wallets.length !== 1 ? "s" : ""} ·{" "}
                {session.ledger.length} transaction{session.ledger.length !== 1 ? "s" : ""}
              </>
            )}
          </div>
          <SessionManager />
        </div>

        {/* Content */}
        {!isLoaded ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
            <p className="text-neutral-500">Loading session...</p>
          </div>
        ) : showWizard ? (
          <Wizard onComplete={() => setWizardComplete(true)} />
        ) : (
          <SetupComplete />
        )}
      </div>
    </div>
  );
}
