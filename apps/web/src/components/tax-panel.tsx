"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { calculateTax, submitProofJob, type TaxBreakdown, type ApiLedgerRow, type PriceEntry } from "@/lib/api";
import {
  IconCalculator,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconAlertCircle,
  IconInfoCircle,
  IconCurrencyRupee,
  IconShieldCheck,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconWallet,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAccount } from "@/lib/starknet-wallet";
import { useConnect, useDisconnect } from "@starknet-react/core";
import { submitTaxProofToStarknet, type LedgerRowForCairo } from "@/lib/starknet";
import { buildTaxReportMarkdown } from "@/lib/fileverse";
import { ReportGenerator } from "@/components/report-generator";

function formatINR(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "₹0.00";

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(num);
}

interface BreakdownRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  sublabel?: string;
  negative?: boolean;
  rebate?: boolean;
}

function BreakdownRow({ label, value, highlight, sublabel, negative, rebate }: BreakdownRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-2", highlight && "bg-neutral-800/30 -mx-3 px-3 rounded-lg")}>
      <div>
        <p className={cn("text-sm", highlight ? "text-neutral-200 font-medium" : "text-neutral-400")}>{label}</p>
        {sublabel && <p className="text-xs text-neutral-500">{sublabel}</p>}
      </div>
      <p
        className={cn(
          "font-mono text-sm",
          highlight ? "text-neutral-200 font-semibold" : "text-neutral-300",
          negative && "text-red-400",
          rebate && "text-green-400",
        )}
      >
        {rebate ? `(−${formatINR(value)})` : formatINR(value)}
      </p>
    </div>
  );
}

function StarknetWalletBar() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (status === "connected" && address) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-300 font-mono">
            {address.slice(0, 8)}…{address.slice(-6)}
          </span>
          <span className="text-xs text-emerald-600">Starknet</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-neutral-700 bg-neutral-900/50 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <IconWallet className="w-4 h-4 text-purple-400" />
        <p className="text-sm font-medium text-neutral-200">Connect Starknet Wallet</p>
        <span className="text-xs text-neutral-500">required for ZK proof</span>
      </div>
      <div className="flex flex-col gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => connect({ connector })}
            className="w-full py-2.5 px-4 rounded-lg border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 hover:border-purple-600/50 text-sm text-neutral-300 hover:text-white transition-all flex items-center gap-3"
          >
            <span className="w-5 h-5 rounded bg-neutral-700 flex items-center justify-center text-xs font-bold text-purple-400">
              {connector.name.slice(0, 1)}
            </span>
            {connector.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TaxPanel() {
  const {
    session,
    setProofArtifacts,
    setTds194sInr,
    setPriorYearBusinessLossInr,
  } = useSession();
  const { account: starknetAccount } = useAccount();
  const { connect, connectors } = useConnect();

  const [breakdown, setBreakdown] = useState<TaxBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [proofElapsed, setProofElapsed] = useState(0);

  const handleCalculate = async () => {
    if (!session.userType) {
      setError("Please select a user type first");
      return;
    }

    if (session.ledger.length === 0) {
      setError("No transactions to calculate tax on");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiLedger: ApiLedgerRow[] = session.ledger.map((row) => {
        const override = session.categoryOverrides.find((o) => o.ledgerRowId === row.id);
        const category = override?.category ?? row.category;

        return {
          chain_id: row.chainId,
          owner_wallet: row.ownerWallet,
          tx_hash: row.txHash,
          block_time: row.blockTime,
          asset: row.asset,
          amount: row.amount,
          decimals: row.decimals,
          direction: row.direction,
          counterparty: row.counterparty ?? null,
          category,
          confidence: row.confidence,
          user_override: override !== undefined,
          cost_basis_inr: row.costBasisInr,
        };
      });

      const apiPrices: PriceEntry[] = session.prices.map((p) => ({
        asset: p.asset,
        usd_price: p.usdPrice,
      }));

      const response = await calculateTax({
        user_type: session.userType,
        ledger: apiLedger,
        prices: apiPrices,
        usd_inr_rate: session.usdInrRate,
        use_44ada: session.use44ada,
        tds_194s_inr: session.tds194sInr,
        prior_year_business_loss_inr: session.priorYearBusinessLossInr,
        is_salaried: session.isSalaried,
        corporate_regime: session.userType === "corporate" ? session.corporateRegime : undefined,
      });

      setBreakdown(response.breakdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate tax");
    } finally {
      setLoading(false);
    }
  };

  const buildApiRequest = () => {
    const apiLedger: ApiLedgerRow[] = session.ledger.map((row) => {
      const override = session.categoryOverrides.find((o) => o.ledgerRowId === row.id);
      const category = override?.category ?? row.category;
      return {
        chain_id: row.chainId,
        owner_wallet: row.ownerWallet,
        tx_hash: row.txHash,
        block_time: row.blockTime,
        asset: row.asset,
        amount: row.amount,
        decimals: row.decimals,
        direction: row.direction,
        counterparty: row.counterparty ?? null,
        category,
        confidence: row.confidence,
        user_override: override !== undefined,
        cost_basis_inr: row.costBasisInr,
      };
    });

    const apiPrices: PriceEntry[] = session.prices.map((p) => ({
      asset: p.asset,
      usd_price: p.usdPrice,
    }));

    return {
      user_type: session.userType!,
      ledger: apiLedger,
      prices: apiPrices,
      usd_inr_rate: session.usdInrRate,
      use_44ada: session.use44ada,
      tds_194s_inr: session.tds194sInr,
      prior_year_business_loss_inr: session.priorYearBusinessLossInr,
      is_salaried: session.isSalaried,
      corporate_regime: session.userType === "corporate" ? session.corporateRegime : undefined,
    };
  };

  const handleGenerateProof = async () => {
    if (!breakdown) {
      setError("Please calculate tax first");
      return;
    }

    if (!starknetAccount) {
      setError("Please connect your Starknet wallet first");
      return;
    }

    const cairoAddress = process.env.NEXT_PUBLIC_CAIRO_CONTRACT_ADDRESS;
    if (!cairoAddress) {
      setError("Cairo contract address not configured — set NEXT_PUBLIC_CAIRO_CONTRACT_ADDRESS in .env.local");
      return;
    }

    setProofLoading(true);
    setProofElapsed(0);
    setProofStatus("");
    setError(null);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setProofElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      setProofStatus("Creating proof job...");
      const request = buildApiRequest();
      const jobId = await submitProofJob(request);

      const cairoRows: LedgerRowForCairo[] = session.ledger.map((row) => {
        const override = session.categoryOverrides.find((o) => o.ledgerRowId === row.id);
        const category = override?.category ?? row.category;
        const price = session.prices.find((p) => p.asset === row.asset);
        const usdPrice = parseFloat(price?.usdPrice ?? "0");
        const usdInr = parseFloat(session.usdInrRate);
        const amount = parseFloat(row.amount) / Math.pow(10, row.decimals);
        const amountPaisa = BigInt(Math.floor(amount * usdPrice * usdInr * 100));
        const costBasisPaisa = BigInt(Math.floor((parseFloat(row.costBasisInr ?? "0") || 0) * 100));

        return {
          category,
          amount_paisa: amountPaisa,
          cost_basis_paisa: costBasisPaisa,
          asset_type: row.asset.includes("ERC721")
            ? "ERC721"
            : row.asset.includes("ERC1155")
              ? "ERC1155"
              : row.asset === "ETH"
                ? "ETH"
                : "ERC20",
          direction: row.direction,
        };
      });

      setProofStatus("Please sign the transaction in your Starknet wallet...");
      const starkResult = await submitTaxProofToStarknet(
        starknetAccount,
        cairoAddress,
        cairoRows,
        session.userType!,
        session.use44ada,
        session.isSalaried,
        session.userType === "corporate" ? session.corporateRegime : "115baa",
        session.priorYearBusinessLossInr,
        session.tds194sInr,
      );

      const proofData = btoa(
        JSON.stringify({
          tx: starkResult.starknet_tx_hash,
          commitment: starkResult.ledger_commitment,
        }),
      );
      const publicValues = btoa(
        JSON.stringify({
          total_tax_paisa: starkResult.total_tax_paisa,
          user_type_code: starkResult.user_type_code,
          used_44ada: starkResult.used_44ada,
        }),
      );

      const proofResult = {
        ledger_commitment: starkResult.ledger_commitment,
        total_tax_paisa: Number(starkResult.total_tax_paisa),
        user_type_code: starkResult.user_type_code,
        used_44ada: starkResult.used_44ada,
        proof: proofData,
        public_values: publicValues,
        vk_hash: starkResult.starknet_tx_hash,
      };

      setProofStatus("Updating proof status...");
      await fetch(`/api/proofs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: proofResult }),
      });

      setProofArtifacts({
        jobId,
        ledgerCommitment: starkResult.ledger_commitment,
        totalTaxPaisa: Number(starkResult.total_tax_paisa),
        userTypeCode: starkResult.user_type_code,
        used44ada: starkResult.used_44ada,
        proof: proofData,
        publicValues: publicValues,
        vkHash: starkResult.starknet_tx_hash,
        note: `Starknet STARK proof — tx ${starkResult.starknet_tx_hash.slice(0, 18)}...`,
        generatedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate proof");
    } finally {
      clearInterval(timer);
      setProofLoading(false);
      setProofStatus("");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasUnreviewedTransactions = session.ledger.some(
    (row) =>
      row.category === "unknown" ||
      (row.confidence < 0.7 && !session.categoryOverrides.find((o) => o.ledgerRowId === row.id)),
  );

  const reportContent = breakdown
    ? buildTaxReportMarkdown({
        breakdown: breakdown as unknown as Record<string, string>,
        userType: session.userType ?? "individual",
        use44ada: session.use44ada,
        wallets: session.wallets.map((w) => w.address),
        proofTxHash: session.proofArtifacts?.vkHash,
        ledgerCommitment: session.proofArtifacts?.ledgerCommitment,
        generatedAt: session.proofArtifacts?.generatedAt,
      })
    : "";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconCalculator className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-neutral-200">Tax Calculation</h3>
        </div>
        {session.use44ada && session.userType === "individual" && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-600/50">
            44ADA Presumptive
          </span>
        )}
      </div>

      {hasUnreviewedTransactions && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-950/30 border border-yellow-900/50 flex items-center gap-2">
          <IconAlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400/80">Some transactions need review. Tax calculation may be inaccurate.</p>
        </div>
      )}

      <div className="mb-4 border border-neutral-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-3 flex items-center justify-between text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <IconInfoCircle className="w-4 h-4" />
            Advanced Inputs
          </span>
          {showAdvanced ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-neutral-700 space-y-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Section 194S TDS Credit (INR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={session.tds194sInr}
                onChange={(e) => setTds194sInr(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
                placeholder="0"
              />
              <p className="text-xs text-neutral-500 mt-1">Enter creditable TDS from Form 26AS.</p>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">Prior Year Business Loss (INR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={session.priorYearBusinessLossInr}
                onChange={(e) => setPriorYearBusinessLossInr(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
                placeholder="0"
              />
              <p className="text-xs text-neutral-500 mt-1">Carry-forward business loss eligible under Section 72.</p>
            </div>
          </div>
        )}
      </div>

      {!breakdown && (
        <button
          onClick={handleCalculate}
          disabled={loading || session.ledger.length === 0}
          className="w-full py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <IconLoader2 className="w-4 h-4 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <IconCalculator className="w-4 h-4" />
              Calculate Tax
            </>
          )}
        </button>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/50 flex items-center gap-2 text-red-400 text-sm">
          <IconAlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {breakdown && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-linear-to-br from-purple-950/50 to-neutral-900 border border-purple-800/50">
            <p className="text-sm text-neutral-400 mb-1">Tax Payable After TDS</p>
            <div className="flex items-center gap-2">
              <IconCurrencyRupee className="w-8 h-8 text-purple-400" />
              <p className="text-3xl font-bold text-white">{formatINR(breakdown.tax_payable_after_tds_inr).replace("₹", "")}</p>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Gross tax: {formatINR(breakdown.total_tax_inr)} · TDS credit: {formatINR(breakdown.tds_194s_credit_inr)}
            </p>
            <p className="text-xs text-neutral-500 mt-2">For FY 2025-26 (AY 2026-27) under new tax regime</p>
          </div>

          <div className="border border-neutral-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full p-3 flex items-center justify-between text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <IconInfoCircle className="w-4 h-4" />
                How we calculated this
              </span>
              {showDetails ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
            </button>

            {showDetails && (
              <div className="p-4 border-t border-neutral-700 space-y-1">
                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Professional Income</p>
                  <BreakdownRow label="Gross Professional Income" value={breakdown.professional_income_inr} />
                  <BreakdownRow
                    label="Current Year Business Loss"
                    value={breakdown.current_year_business_loss_inr}
                    negative
                    sublabel="Income-category outflows tracked for Sec 72"
                  />
                  <BreakdownRow
                    label="Standard Deduction"
                    value={breakdown.standard_deduction_inr}
                    rebate
                    sublabel="₹75,000 for salaried/pensioners"
                  />
                  {session.use44ada && session.userType === "individual" && (
                    <BreakdownRow
                      label="After 44ADA (50%)"
                      value={breakdown.taxable_professional_income_inr}
                      sublabel="Presumptive taxation applied"
                    />
                  )}
                  {(!session.use44ada || session.userType !== "individual") && (
                    <BreakdownRow label="Taxable Professional Income" value={breakdown.taxable_professional_income_inr} />
                  )}
                  <BreakdownRow label="Income Tax (Slab)" value={breakdown.professional_tax_inr} highlight />
                  <BreakdownRow label="Surcharge" value={breakdown.surcharge_inr} />
                  {parseFloat(breakdown.section_87a_rebate_inr) > 0 && (
                    <BreakdownRow
                      label="Section 87A Rebate"
                      value={breakdown.section_87a_rebate_inr}
                      rebate
                      sublabel="For income ≤ ₹12L under new regime"
                    />
                  )}
                  {parseFloat(breakdown.marginal_relief_inr) > 0 && (
                    <BreakdownRow
                      label="Marginal Relief"
                      value={breakdown.marginal_relief_inr}
                      rebate
                      sublabel="Cliff relief near ₹12 lakh"
                    />
                  )}
                </div>

                <div className="border-t border-neutral-700/50 my-3" />

                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Virtual Digital Assets (115BBH)</p>
                  <BreakdownRow label="VDA Gains (Gross)" value={breakdown.vda_gains_gross_inr} />
                  <BreakdownRow label="Cost of Acquisition" value={breakdown.total_cost_basis_inr} negative />
                  <BreakdownRow
                    label="Fees as COA"
                    value={breakdown.fees_as_coa_inr}
                    negative
                    sublabel="Gas fees on outgoing transactions"
                  />
                  <BreakdownRow label="Net VDA Gains" value={breakdown.net_vda_gains_inr} />
                  <BreakdownRow
                    label="VDA Losses (not offset)"
                    value={breakdown.vda_losses_inr}
                    negative
                    sublabel="Losses cannot be set off per Section 115BBH"
                  />
                  <BreakdownRow label="VDA Tax (30%)" value={breakdown.vda_tax_inr} highlight />
                </div>

                <div className="border-t border-neutral-700/50 my-3" />

                <div>
                  <BreakdownRow label="Health & Education Cess (4%)" value={breakdown.cess_inr} />
                  <BreakdownRow label="TDS Credit (Section 194S)" value={breakdown.tds_194s_credit_inr} rebate />
                  <div className="border-t border-neutral-600 my-2" />
                  <BreakdownRow label="Total Tax (Before TDS)" value={breakdown.total_tax_inr} highlight />
                  <BreakdownRow label="Tax Payable (After TDS)" value={breakdown.tax_payable_after_tds_inr} highlight />
                </div>

                <div className="border-t border-neutral-700/50 my-3" />

                <div>
                  <BreakdownRow
                    label="Carry-forward Loss Remaining"
                    value={breakdown.carry_forward_loss_remaining_inr}
                  />
                  <p className="text-xs text-neutral-500 mt-2">{breakdown.loss_carry_forward_note}</p>
                </div>
              </div>
            )}
          </div>

          {breakdown.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 space-y-1">
              {breakdown.warnings.map((warning, index) => (
                <p key={`${warning}-${index}`} className="text-xs text-amber-300">
                  {warning}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconCalculator className="w-4 h-4" />}
              Recalculate
            </button>
          </div>

          {/* Download / Publish section */}
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Export Report</p>

            <ReportGenerator
              reportTitle="ProofOS Tax Report - FY 2025-26"
              reportContent={reportContent}
              fileName={`proofos-tax-report-${new Date().toISOString().slice(0, 10)}.md`}
            />
          </div>

          {/* ZK section */}
          <div className="space-y-3 mt-2">
            <div className="border-t border-neutral-800 pt-4" />

            {session.proofArtifacts && (
              <div className="p-4 rounded-xl bg-linear-to-br from-emerald-950/60 to-neutral-900 border border-emerald-700/50 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <IconShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">ZK Proof Generated</p>
                    <p className="text-xs text-neutral-500">STARK proof committed on Starknet Sepolia</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Starknet Transaction</p>
                  <div className="flex items-center gap-2 bg-neutral-800/50 rounded-lg px-3 py-2">
                    <code className="text-xs text-neutral-200 font-mono flex-1 truncate">
                      {session.proofArtifacts.vkHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(session.proofArtifacts!.vkHash, "txHash")}
                      className="p-1 hover:bg-neutral-700 rounded"
                    >
                      {copied === "txHash" ? (
                        <IconCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <IconCopy className="w-3 h-3 text-neutral-400" />
                      )}
                    </button>
                    <a
                      href={`https://sepolia.starkscan.co/tx/${session.proofArtifacts.vkHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                      title="View on Starkscan"
                    >
                      <IconExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Ledger Commitment</p>
                  <div className="flex items-center gap-2 bg-neutral-800/50 rounded-lg px-3 py-2">
                    <code className="text-xs text-neutral-300 font-mono flex-1 truncate">
                      {session.proofArtifacts.ledgerCommitment}
                    </code>
                    <button
                      onClick={() => copyToClipboard(session.proofArtifacts!.ledgerCommitment, "commitment")}
                      className="p-1 hover:bg-neutral-700 rounded"
                    >
                      {copied === "commitment" ? (
                        <IconCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <IconCopy className="w-3 h-3 text-neutral-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-neutral-500">Total Tax Committed</span>
                  <span className="text-sm font-semibold text-white">
                    ₹
                    {(session.proofArtifacts.totalTaxPaisa / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`https://sepolia.starkscan.co/tx/${session.proofArtifacts.vkHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <IconExternalLink className="w-3 h-3" />
                    View on Starkscan
                  </a>
                  <Link
                    href="/verify"
                    className="flex-1 py-2 px-3 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-sm text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <IconShieldCheck className="w-3 h-3" />
                    Verify On-Chain
                  </Link>
                </div>
              </div>
            )}

            <StarknetWalletBar />

            {!session.proofArtifacts &&
              (starknetAccount ? (
                <button
                  onClick={handleGenerateProof}
                  disabled={proofLoading}
                  className="w-full py-3 rounded-lg font-medium bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-700/50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
                >
                  {proofLoading ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      {proofStatus || `Generating… ${proofElapsed}s`}
                    </>
                  ) : (
                    <>
                      <IconShieldCheck className="w-4 h-4" />
                      Generate ZK Proof
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2 text-center py-2">
                  <button
                    onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                    disabled={connectors.length === 0}
                    className="w-full py-3 rounded-lg font-medium bg-purple-700 hover:bg-purple-600 disabled:bg-purple-700/40 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <IconWallet className="w-4 h-4" />
                    Connect Starknet Wallet to Generate Proof
                  </button>
                  <p className="text-xs text-neutral-500">
                    Connect your Starknet wallet above to generate a privacy-preserving proof
                  </p>
                </div>
              ))}
          </div>

          <div className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
            <p className="text-xs text-neutral-500">
              <strong className="text-neutral-400">Disclaimer:</strong> This calculation is for informational
              purposes only. Not legal or financial advice. Consult a qualified tax professional before filing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
