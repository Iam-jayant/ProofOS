// ProofOS Core Tax Engine — TypeScript port of crates/core/src/lib.rs
// Line-by-line port: same constants, same slab boundaries, same order of operations,
// same paisa arithmetic. Do NOT simplify.

// ============================================================================
// TYPES (mirrors crates/core/src/lib.rs structs)
// ============================================================================

export type UserType = "individual" | "huf" | "corporate";

export type Direction = "in" | "out";

export type Category =
  | "income"
  | "gains"
  | "losses"
  | "fees"
  | "internal"
  | "unknown";

export interface LedgerRow {
  chain_id: number;
  owner_wallet: string;
  tx_hash: string;
  block_time: number;
  asset: string;
  amount: string; // String to preserve precision (matches Rust)
  decimals: number;
  direction: Direction;
  counterparty: string | null;
  category: Category;
  confidence: number;
  user_override: boolean;
  cost_basis_inr?: string;
}

export interface PriceEntry {
  asset: string;
  usd_price: string; // String to preserve precision (matches Rust)
}

export interface TaxInput {
  user_type: UserType;
  wallets: string[]; // wallet addresses
  ledger: LedgerRow[];
  prices: PriceEntry[];
  usd_inr_rate: string;
  use_44ada: boolean;
  tds_194s_inr?: string;
  prior_year_business_loss_inr?: string;
  is_salaried?: boolean;
  corporate_regime?: "115baa" | "regular";
}

export interface TaxBreakdown {
  // Income
  professional_income_inr: string;
  standard_deduction_inr: string;
  current_year_business_loss_inr: string;
  taxable_professional_income_inr: string;

  // VDA
  vda_gains_gross_inr: string;
  total_cost_basis_inr: string;
  fees_as_coa_inr: string;
  net_vda_gains_inr: string;
  vda_losses_inr: string;

  // Tax components
  professional_tax_inr: string;
  surcharge_inr: string;
  section_87a_rebate_inr: string;
  marginal_relief_inr: string;
  vda_tax_inr: string;
  cess_inr: string;

  // Final
  total_tax_inr: string;
  tds_194s_credit_inr: string;
  tax_payable_after_tds_inr: string;

  // Carry-forward
  carry_forward_loss_remaining_inr: string;
  loss_carry_forward_note: string;

  // Metadata
  warnings: string[];
}

export interface CategorizationResult {
  category: Category;
  confidence: number;
}

// ============================================================================
// TAX CONSTANTS (mirrors lib.rs const declarations)
// ============================================================================

// New regime tax slabs for AY 2026-27 (Individual/HUF)
// [lower, upper, rate] — same values as NEW_REGIME_SLABS in lib.rs
const NEW_REGIME_SLABS: [number, number, number][] = [
  [0, 400_000, 0.0],           // Up to 4L: 0%
  [400_001, 800_000, 0.05],    // 4L-8L: 5%
  [800_001, 1_200_000, 0.10],  // 8L-12L: 10%
  [1_200_001, 1_600_000, 0.15], // 12L-16L: 15%
  [1_600_001, 2_000_000, 0.20], // 16L-20L: 20%
  [2_000_001, 2_400_000, 0.25], // 20L-24L: 25%
  [2_400_001, Number.MAX_SAFE_INTEGER, 0.30], // Above 24L: 30%
];

// VDA tax rate under Section 115BBH
const VDA_TAX_RATE = 0.30;

// Corporate regimes
const CORP_115BAA_RATE = 0.22;
const CORP_REGULAR_RATE = 0.30;
const CORP_SURCHARGE_115BAA = 0.10;
const CORP_SURCHARGE_REGULAR_1CR = 0.07;
const CORP_SURCHARGE_REGULAR_10CR = 0.12;
const CORP_1CR = 10_000_000;
const CORP_10CR = 100_000_000;

// Health & Education Cess rate
const CESS_RATE = 0.04;

// 44ADA presumptive income rate
const PRESUMPTIVE_44ADA_RATE = 0.50;
const MAX_44ADA_TURNOVER = 5_000_000;

// Salaried standard deduction under new regime
const STANDARD_DEDUCTION_SALARIED = 75_000;

// Section 87A rebate limit (Individual/HUF under new regime)
// FY 2025-26 (AY 2026-27): Rebate up to ₹60,000 if taxable income ≤ ₹12 lakh
const SECTION_87A_INCOME_LIMIT = 1_200_000; // ₹12 lakh
const SECTION_87A_REBATE_MAX = 60_000;      // ₹60,000

// Individual/HUF surcharge bands under new regime
const SURCHARGE_BANDS: [number, number, number][] = [
  [5_000_000, 10_000_000, 0.10],
  [10_000_000, 20_000_000, 0.15],
  [20_000_000, 50_000_000, 0.25],
  [50_000_000, Number.MAX_SAFE_INTEGER, 0.25],
];

// ============================================================================
// SLAB TAX (mirrors calculate_slab_tax fn in lib.rs)
// ============================================================================

function calculateSlabTax(taxableIncome: number): number {
  let tax = 0;

  for (const [lower, upper, rate] of NEW_REGIME_SLABS) {
    if (taxableIncome > lower) {
      const amountInSlab =
        taxableIncome >= upper
          ? upper - lower
          : taxableIncome - lower;
      tax += Math.trunc(amountInSlab * rate);
    }

    if (taxableIncome <= upper) {
      break;
    }
  }

  return tax;
}

function calculateSurcharge(slabTax: number, totalIncome: number): number {
  for (const [lower, upper, rate] of SURCHARGE_BANDS) {
    if (totalIncome > lower && totalIncome <= upper) {
      return Math.trunc(slabTax * rate);
    }
  }
  if (totalIncome > 50_000_000) {
    return Math.trunc(slabTax * 0.25);
  }
  return 0;
}

// ============================================================================
// AMOUNT → INR CONVERSION (mirrors amount_to_inr fn in lib.rs)
// ============================================================================

function amountToInr(
  amount: string,
  asset: string,
  prices: PriceEntry[],
  usdInrRate: number,
): number {
  const amountVal = parseFloat(amount) || 0.0;

  const usdPrice =
    prices.find((p) => p.asset === asset)?.usd_price
      ? parseFloat(prices.find((p) => p.asset === asset)!.usd_price) || 1.0
      : 1.0;

  return amountVal * usdPrice * usdInrRate;
}

// ============================================================================
// CATEGORIZE TRANSACTION (mirrors categorize_transaction fn in lib.rs)
// ============================================================================

export function categorizeTransaction(
  row: LedgerRow,
  userWallets: string[],
): CategorizationResult {
  const counterparty = row.counterparty?.toLowerCase() ?? null;
  const userWalletsLower = userWallets.map((w) => w.toLowerCase());

  // Rule 1: Internal transfer between user's own wallets
  if (counterparty && userWalletsLower.includes(counterparty)) {
    return { category: "internal", confidence: 1.0 };
  }

  // Rule 2: Small ETH outflows are likely fees.
  if (row.direction === "out") {
    if (row.asset === "ETH") {
      const amount = parseFloat(row.amount);
      if (amount < 0.01) {
        return { category: "fees", confidence: 0.8 };
      }
    }
  }

  // Rule 3: Other inflows = Income (professional income)
  if (row.direction === "in") {
    return { category: "income", confidence: 0.6 };
  }

  // Rule 4: Can't determine
  return { category: "unknown", confidence: 0.0 };
}

// ============================================================================
// CATEGORIZE LEDGER (mirrors categorize_ledger fn in lib.rs)
// ============================================================================

export function categorizeLedger(
  ledger: LedgerRow[],
  userWallets: string[],
): LedgerRow[] {
  return ledger.map((row) => {
    const result = categorizeTransaction(row, userWallets);
    return { ...row, category: result.category, confidence: result.confidence };
  });
}

// ============================================================================
// CALCULATE TAX (mirrors calculate_tax fn in lib.rs — same order of operations)
// ============================================================================

export function calculateTax(input: TaxInput): TaxBreakdown {
  const usdInrRate = parseFloat(input.usd_inr_rate) || 83.0;
  const warnings: string[] = [];

  // Sum up amounts by category
  let professionalIncomeInr = 0.0;
  let businessLossCurrentYearInr = 0.0;

  let vdaGainsGrossInr = 0.0;
  let vdaGainsAfterCostBasisInr = 0.0;
  let totalCostBasisInr = 0.0;
  let totalFeesAsCoaInr = 0.0;
  let vdaLossesInr = 0.0;

  for (const row of input.ledger) {
    const inrValue = amountToInr(row.amount, row.asset, input.prices, usdInrRate);

    if (row.category === "income") {
      if (row.direction === "in") {
        professionalIncomeInr += inrValue;
      } else if (row.direction === "out") {
        businessLossCurrentYearInr += inrValue;
      }
    } else if (row.category === "gains") {
      if (row.direction === "in") {
        const costBasis = row.cost_basis_inr ? parseFloat(row.cost_basis_inr) || 0 : 0;
        const netGain = Math.max(0, inrValue - costBasis);
        vdaGainsGrossInr += inrValue;
        totalCostBasisInr += costBasis;
        vdaGainsAfterCostBasisInr += netGain;
      }
    } else if (row.category === "losses") {
      // 115BBH: VDA losses are informational only and cannot offset gains.
      if (row.direction === "out") {
        vdaLossesInr += inrValue;
      }
    } else if (row.category === "fees") {
      if (row.direction === "out") {
        totalFeesAsCoaInr += inrValue;
      }
    }
  }

  const priorLossInr = parseFloat(input.prior_year_business_loss_inr ?? "0") || 0;
  const netProfessionalIncomeInr = Math.max(0, professionalIncomeInr - businessLossCurrentYearInr);
  const incomeAfterCarryForwardInr = Math.max(0, netProfessionalIncomeInr - priorLossInr);
  const carryForwardLossRemainingInr = Math.max(0, priorLossInr - netProfessionalIncomeInr);

  const eligible44ada =
    input.use_44ada &&
    input.user_type === "individual" &&
    incomeAfterCarryForwardInr <= MAX_44ADA_TURNOVER;

  if (input.use_44ada && !eligible44ada) {
    warnings.push("44ADA not applicable: gross professional receipts exceed ₹50 lakh.");
  }

  const taxableProfessionalBeforeStdInr = eligible44ada
    ? incomeAfterCarryForwardInr * PRESUMPTIVE_44ADA_RATE
    : incomeAfterCarryForwardInr;

  const standardDeductionInr =
    input.is_salaried && input.user_type === "individual"
      ? STANDARD_DEDUCTION_SALARIED
      : 0;

  const taxableProfessionalIncomeInr = Math.max(
    0,
    taxableProfessionalBeforeStdInr - standardDeductionInr,
  );

  const netVdaGainsInr = Math.max(0, vdaGainsAfterCostBasisInr - totalFeesAsCoaInr);

  // Calculate professional income tax based on user type
  let professionalTaxBaseInr = 0;
  let section87aRebateInr = 0;
  let marginalReliefInr = 0;
  let surchargeInr = 0;
  let professionalTaxAfterAdjustmentsInr = 0;

  if (input.user_type === "individual" || input.user_type === "huf") {
    const taxableIncomeTrunc = Math.trunc(taxableProfessionalIncomeInr);
    const slabTax = calculateSlabTax(taxableIncomeTrunc);

    if (taxableIncomeTrunc <= SECTION_87A_INCOME_LIMIT) {
      section87aRebateInr = Math.min(slabTax, SECTION_87A_REBATE_MAX);
      marginalReliefInr = 0;
    } else {
      const excess = taxableIncomeTrunc - SECTION_87A_INCOME_LIMIT;
      marginalReliefInr = slabTax > excess ? slabTax - excess : 0;
    }

    const totalIncomeForSurcharge = taxableProfessionalIncomeInr + netVdaGainsInr;
    surchargeInr = calculateSurcharge(slabTax, totalIncomeForSurcharge);
    professionalTaxBaseInr = slabTax;
    professionalTaxAfterAdjustmentsInr = slabTax - section87aRebateInr - marginalReliefInr + surchargeInr;
  } else {
    const isRegular = input.corporate_regime === "regular";
    const corpRate = isRegular ? CORP_REGULAR_RATE : CORP_115BAA_RATE;
    const baseTax = taxableProfessionalIncomeInr * corpRate;

    let corpSurchargeRate = 0;
    if (!isRegular) {
      corpSurchargeRate = CORP_SURCHARGE_115BAA;
    } else if (taxableProfessionalIncomeInr > CORP_10CR) {
      corpSurchargeRate = CORP_SURCHARGE_REGULAR_10CR;
    } else if (taxableProfessionalIncomeInr > CORP_1CR) {
      corpSurchargeRate = CORP_SURCHARGE_REGULAR_1CR;
    }

    surchargeInr = Math.trunc(baseTax * corpSurchargeRate);
    professionalTaxBaseInr = Math.trunc(baseTax);
    professionalTaxAfterAdjustmentsInr = professionalTaxBaseInr + surchargeInr;
  }

  // VDA tax at 30% on adjusted net gains (after COA + fees)
  const vdaTaxInr = Math.trunc(netVdaGainsInr * VDA_TAX_RATE);

  // Total tax before cess
  const totalBeforeCess = professionalTaxAfterAdjustmentsInr + vdaTaxInr;

  // Health & Education Cess at 4%
  const cessInr = Math.trunc(totalBeforeCess * CESS_RATE);

  // Total tax payable
  const totalTaxInr = totalBeforeCess + cessInr;
  const tdsCreditInr = parseFloat(input.tds_194s_inr ?? "0") || 0;
  const taxPayableAfterTdsInr = Math.max(0, totalTaxInr - tdsCreditInr);

  const lossCarryForwardNote =
    vdaLossesInr > 0
      ? `VDA losses of ₹${vdaLossesInr.toFixed(0)} cannot be carried forward (Sec 115BBH). Business losses of ₹${businessLossCurrentYearInr.toFixed(0)} are eligible for 8-year carry-forward.`
      : `Business losses of ₹${businessLossCurrentYearInr.toFixed(0)} are eligible for 8-year carry-forward.`;

  return {
    professional_income_inr: professionalIncomeInr.toFixed(2),
    standard_deduction_inr: standardDeductionInr.toFixed(2),
    current_year_business_loss_inr: businessLossCurrentYearInr.toFixed(2),
    taxable_professional_income_inr: taxableProfessionalIncomeInr.toFixed(2),

    vda_gains_gross_inr: vdaGainsGrossInr.toFixed(2),
    total_cost_basis_inr: totalCostBasisInr.toFixed(2),
    fees_as_coa_inr: totalFeesAsCoaInr.toFixed(2),
    net_vda_gains_inr: netVdaGainsInr.toFixed(2),
    vda_losses_inr: vdaLossesInr.toFixed(2),

    professional_tax_inr: professionalTaxBaseInr.toFixed(2),
    surcharge_inr: surchargeInr.toFixed(2),
    section_87a_rebate_inr: section87aRebateInr.toFixed(2),
    marginal_relief_inr: marginalReliefInr.toFixed(2),
    vda_tax_inr: vdaTaxInr.toFixed(2),
    cess_inr: cessInr.toFixed(2),

    total_tax_inr: totalTaxInr.toFixed(2),
    tds_194s_credit_inr: tdsCreditInr.toFixed(2),
    tax_payable_after_tds_inr: taxPayableAfterTdsInr.toFixed(2),

    carry_forward_loss_remaining_inr: carryForwardLossRemainingInr.toFixed(2),
    loss_carry_forward_note: lossCarryForwardNote,

    warnings,
  };
}

// ============================================================================
// PAISA CONVERSION (used by ZK/Starknet layer — total_tax_paisa field)
// ============================================================================

/** Convert INR string to paisa (integer, no decimals) */
export function inrToPaisa(inrStr: string): bigint {
  const val = parseFloat(inrStr);
  return BigInt(Math.round(val * 100));
}
