"use client";

import { useState, useRef } from "react";
import { useSession, type LedgerRow, type Category } from "@/lib/session";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconExternalLink,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(Math.min(4, decimals));
}

const categoryColors: Record<string, string> = {
  income: "text-green-400 bg-green-950/50 border-green-800/50",
  gains: "text-emerald-400 bg-emerald-950/50 border-emerald-800/50",
  losses: "text-red-400 bg-red-950/50 border-red-800/50",
  fees: "text-orange-400 bg-orange-950/50 border-orange-800/50",
  internal: "text-blue-400 bg-blue-950/50 border-blue-800/50",
  unknown: "text-neutral-400 bg-neutral-800/50 border-neutral-700/50",
};

const categoryLabels: Record<Category, string> = {
  income: "Income",
  gains: "Gains",
  losses: "Losses",
  fees: "Fees",
  internal: "Internal",
  unknown: "Unknown",
};

type TabFilter = "all" | "review" | Category;

interface CategoryTabProps {
  active: TabFilter;
  tab: TabFilter;
  label: string;
  count: number;
  onClick: () => void;
  variant?: "default" | "warning";
}

function CategoryTab({ active, tab, label, count, onClick, variant = "default" }: CategoryTabProps) {
  const isActive = active === tab;

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5",
        isActive
          ? variant === "warning"
            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-600/50"
            : "bg-neutral-700 text-white border border-neutral-600"
          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
      )}
    >
      {variant === "warning" && <IconAlertTriangle className="w-3 h-3" />}
      {label}
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full",
        isActive
          ? variant === "warning"
            ? "bg-yellow-500/30 text-yellow-300"
            : "bg-neutral-600 text-neutral-200"
          : "bg-neutral-800 text-neutral-500"
      )}>
        {count}
      </span>
    </button>
  );
}

interface CategorySelectProps {
  row: LedgerRow;
  effectiveCategory: Category;
  hasOverride: boolean;
  onOverride: (category: Category) => void;
  onClearOverride: () => void;
}

function CategorySelect({ row, effectiveCategory, hasOverride, onOverride, onClearOverride }: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const categories: Category[] = ["income", "gains", "losses", "fees", "internal", "unknown"];

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.right - 140, // align right edge
      });
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={cn(
          "px-2 py-0.5 rounded text-xs border flex items-center gap-1",
          categoryColors[effectiveCategory],
          hasOverride && "ring-1 ring-purple-500/50"
        )}
      >
        {categoryLabels[effectiveCategory]}
        {hasOverride && (
          <span className="text-purple-400 text-[10px]">(edited)</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onOverride(cat);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-neutral-700/50",
                  effectiveCategory === cat && "bg-neutral-700/30"
                )}
              >
                <span className={cn(
                  "px-1.5 py-0.5 rounded border text-[10px]",
                  categoryColors[cat]
                )}>
                  {categoryLabels[cat]}
                </span>
                {effectiveCategory === cat && (
                  <IconCheck className="w-3 h-3 text-green-400" />
                )}
              </button>
            ))}
            {hasOverride && (
              <>
                <div className="border-t border-neutral-700 my-1" />
                <button
                  onClick={() => {
                    onClearOverride();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-neutral-700/50 flex items-center gap-1"
                >
                  <IconX className="w-3 h-3" />
                  Reset to original
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function LedgerTable() {
  const { session, setCategoryOverride, removeCategoryOverride } = useSession();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [walletFilter, setWalletFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Build a map of overrides for quick lookup
  const overrideMap = new Map<string, Category>();
  for (const override of session.categoryOverrides) {
    overrideMap.set(override.ledgerRowId, override.category);
  }

  // Get effective category for a row (override > original)
  const getEffectiveCategory = (row: LedgerRow): Category => {
    return overrideMap.get(row.id) ?? row.category;
  };

  // Check if row needs review (low confidence or unknown)
  const needsReview = (row: LedgerRow): boolean => {
    const effective = getEffectiveCategory(row);
    return effective === "unknown" || (row.confidence < 0.7 && !overrideMap.has(row.id));
  };

  // Count by category
  const counts = {
    all: session.ledger.length,
    review: session.ledger.filter(needsReview).length,
    income: session.ledger.filter((r) => getEffectiveCategory(r) === "income").length,
    gains: session.ledger.filter((r) => getEffectiveCategory(r) === "gains").length,
    losses: session.ledger.filter((r) => getEffectiveCategory(r) === "losses").length,
    fees: session.ledger.filter((r) => getEffectiveCategory(r) === "fees").length,
    internal: session.ledger.filter((r) => getEffectiveCategory(r) === "internal").length,
    unknown: session.ledger.filter((r) => getEffectiveCategory(r) === "unknown").length,
  };

  const filteredLedger = session.ledger.filter((row) => {
    // Wallet filter
    if (walletFilter !== "all" && row.ownerWallet !== walletFilter) return false;

    // Tab filter
    if (activeTab === "all") return true;
    if (activeTab === "review") return needsReview(row);
    return getEffectiveCategory(row) === activeTab;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLedger.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLedger.length);
  const paginatedLedger = filteredLedger.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleWalletFilterChange = (wallet: string) => {
    setWalletFilter(wallet);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const wallets = ["all", ...new Set(session.ledger.map((r) => r.ownerWallet))];

  if (session.ledger.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center">
        <p className="text-neutral-500">No transactions synced yet.</p>
        <p className="text-neutral-600 text-sm mt-1">
          Click &quot;Sync Transactions&quot; to fetch your on-chain activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryTab
          active={activeTab}
          tab="all"
          label="All"
          count={counts.all}
          onClick={() => handleTabChange("all")}
        />
        {counts.review > 0 && (
          <CategoryTab
            active={activeTab}
            tab="review"
            label="Needs Review"
            count={counts.review}
            onClick={() => handleTabChange("review")}
            variant="warning"
          />
        )}
        <div className="w-px h-5 bg-neutral-700 mx-1" />
        <CategoryTab
          active={activeTab}
          tab="income"
          label="Income"
          count={counts.income}
          onClick={() => handleTabChange("income")}
        />
        <CategoryTab
          active={activeTab}
          tab="gains"
          label="Gains"
          count={counts.gains}
          onClick={() => handleTabChange("gains")}
        />
        <CategoryTab
          active={activeTab}
          tab="losses"
          label="Losses"
          count={counts.losses}
          onClick={() => handleTabChange("losses")}
        />
        <CategoryTab
          active={activeTab}
          tab="fees"
          label="Fees"
          count={counts.fees}
          onClick={() => handleTabChange("fees")}
        />
        <CategoryTab
          active={activeTab}
          tab="internal"
          label="Internal"
          count={counts.internal}
          onClick={() => handleTabChange("internal")}
        />
        <CategoryTab
          active={activeTab}
          tab="unknown"
          label="Unknown"
          count={counts.unknown}
          onClick={() => handleTabChange("unknown")}
        />
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap items-center gap-3">
        {wallets.length > 2 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Wallet:</span>
            <select
              value={walletFilter}
              onChange={(e) => handleWalletFilterChange(e.target.value)}
              className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 focus:outline-none font-mono"
            >
              {wallets.map((w) => (
                <option key={w} value={w}>
                  {w === "all" ? "All Wallets" : shortenAddress(w)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-neutral-500 ml-auto">
          {filteredLedger.length > 0 ? `${startIndex + 1}-${endIndex}` : "0"} of {filteredLedger.length} transactions
          {session.categoryOverrides.length > 0 && (
            <span className="text-purple-400 ml-2">
              ({session.categoryOverrides.length} override{session.categoryOverrides.length !== 1 ? "s" : ""})
            </span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-800">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-800/50 text-neutral-400 text-xs uppercase tracking-wide">
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Direction</th>
                <th className="text-left p-3 font-medium">Asset</th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Counterparty</th>
                <th className="text-left p-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {paginatedLedger.map((row) => {
                const effectiveCategory = getEffectiveCategory(row);
                const hasOverride = overrideMap.has(row.id);
                const isReviewNeeded = needsReview(row);

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-neutral-800/30 transition-colors",
                      isReviewNeeded && "bg-yellow-950/10"
                    )}
                  >
                    <td className="p-3 text-neutral-300 whitespace-nowrap">
                      {formatDate(row.blockTime)}
                    </td>
                    <td className="p-3">
                      {row.direction === "in" ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <IconArrowDownLeft className="w-4 h-4" />
                          In
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <IconArrowUpRight className="w-4 h-4" />
                          Out
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-200 font-medium">
                      {row.asset}
                    </td>
                    <td className="p-3 text-right font-mono text-neutral-200">
                      {row.direction === "in" ? "+" : "-"}
                      {formatAmount(row.amount, row.decimals)}
                    </td>
                    <td className="p-3">
                      <CategorySelect
                        row={row}
                        effectiveCategory={effectiveCategory}
                        hasOverride={hasOverride}
                        onOverride={(cat) => setCategoryOverride(row.id, cat)}
                        onClearOverride={() => removeCategoryOverride(row.id)}
                      />
                    </td>
                    <td className="p-3 font-mono text-xs text-neutral-400">
                      {row.counterparty ? shortenAddress(row.counterparty) : "—"}
                    </td>
                    <td className="p-3">
                      <a
                        href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {shortenHash(row.txHash)}
                        <IconExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-800/30">
            <div className="text-xs text-neutral-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-neutral-400 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
              >
                <IconChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-7 h-7 text-xs rounded transition-colors",
                        currentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "text-neutral-400 hover:text-white hover:bg-neutral-700"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
              >
                <IconChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-neutral-400 hover:text-white hover:bg-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review hint */}
      {counts.review > 0 && activeTab !== "review" && (
        <div className="p-3 rounded-lg bg-yellow-950/30 border border-yellow-900/50 flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-400/80">
            <strong>{counts.review} transaction{counts.review !== 1 ? "s" : ""}</strong> need{counts.review === 1 ? "s" : ""} review.
            {" "}
            <button
              onClick={() => handleTabChange("review")}
              className="underline hover:text-yellow-300"
            >
              Review now
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
