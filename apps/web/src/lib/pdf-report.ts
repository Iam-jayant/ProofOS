import jsPDF from "jspdf";
import type { TaxBreakdown } from "./api";

export interface PdfReportInput {
  breakdown: TaxBreakdown;
  wallets: string[];
  userType: string;
  use44ada: boolean;
  proofTxHash?: string;
  ledgerCommitment?: string;
  generatedAt?: number;
}

function inr(v: string): string {
  const n = parseFloat(v);
  return isNaN(n)
    ? "INR 0.00"
    : n.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
}

export function generateTaxReportPdf(input: PdfReportInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { breakdown } = input;
  const margin = 20;
  const pageW = 210;
  const contentW = pageW - 2 * margin;
  let y = margin;

  const line = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  const section = (title: string) => {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(title.toUpperCase(), margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
  };

  const row = (label: string, value: string, isBold = false, isGreen = false) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(isGreen ? 34 : 30, isGreen ? 139 : 30, isGreen ? 34 : 30);
    doc.text(label, margin, y);
    doc.text(value, pageW - margin, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 6;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("ProofOS", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Indian Crypto Tax Report", margin, y + 7);
  doc.text(
    `Generated: ${new Date(input.generatedAt ?? Date.now()).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    })}`,
    pageW - margin,
    y,
    { align: "right" }
  );
  doc.text("FY 2025-26 (AY 2026-27)", pageW - margin, y + 7, { align: "right" });

  y += 16;
  line();

  section("Taxpayer Information");
  row("Entity Type", input.userType === "individual" ? "Individual" : input.userType === "huf" ? "HUF" : "Company (Corporate)");
  row("Tax Regime", "New Regime (Section 115BAC)");
  row("Section 44ADA", input.use44ada ? "Applied (50% presumptive)" : "Not applied");
  if (input.wallets.length > 0) {
    input.wallets.slice(0, 3).forEach((w, i) => {
      row(`Wallet ${i + 1}`, `${w.slice(0, 10)}...${w.slice(-8)}`);
    });
    if (input.wallets.length > 3) {
      row(`+ ${input.wallets.length - 3} more wallets`, "");
    }
  }
  y += 2;
  line();

  section("Professional Income (Section 115BAC Slabs)");
  row("Gross Professional Income", inr(breakdown.professional_income_inr));
  if (parseFloat(breakdown.standard_deduction_inr ?? "0") > 0) {
    row("Standard Deduction (Sec 16)", `(${inr(breakdown.standard_deduction_inr)})`);
  }
  if (parseFloat(breakdown.current_year_business_loss_inr ?? "0") > 0) {
    row("Business Loss (Current Year)", `(${inr(breakdown.current_year_business_loss_inr)})`);
  }
  if (input.use44ada) {
    row("Taxable Income after 44ADA (50%)", inr(breakdown.taxable_professional_income_inr));
  }
  row("Slab Tax (Before Adjustments)", inr(breakdown.professional_tax_inr));
  if (parseFloat(breakdown.surcharge_inr ?? "0") > 0) {
    row("Surcharge", inr(breakdown.surcharge_inr));
  }
  if (parseFloat(breakdown.section_87a_rebate_inr) > 0) {
    row("Section 87A Rebate", `(${inr(breakdown.section_87a_rebate_inr)})`, false, true);
  }
  if (parseFloat(breakdown.marginal_relief_inr ?? "0") > 0) {
    row("Marginal Relief", `(${inr(breakdown.marginal_relief_inr)})`, false, true);
  }
  y += 2;
  line();

  section("Virtual Digital Assets - Section 115BBH");
  row("Gross VDA Gains", inr((breakdown as unknown as Record<string, string>).vda_gains_inr ?? breakdown.vda_gains_gross_inr));
  if (parseFloat(breakdown.total_cost_basis_inr ?? "0") > 0) {
    row("Cost of Acquisition", `(${inr(breakdown.total_cost_basis_inr)})`);
  }
  if (parseFloat(breakdown.fees_as_coa_inr ?? "0") > 0) {
    row("Gas Fees (COA component)", `(${inr(breakdown.fees_as_coa_inr)})`);
  }
  row("Net VDA Gains (Taxable)", inr(breakdown.net_vda_gains_inr));
  if (parseFloat(breakdown.vda_losses_inr) > 0) {
    row("VDA Losses (non-deductible, Sec 115BBH)", inr(breakdown.vda_losses_inr));
  }
  row("VDA Tax @ 30%", inr(breakdown.vda_tax_inr));
  y += 2;
  line();

  section("Tax Summary");
  row(
    "Total Before Cess",
    inr((parseFloat(breakdown.professional_tax_inr) + parseFloat(breakdown.vda_tax_inr)).toString()),
  );
  row("Health & Education Cess (4%)", inr(breakdown.cess_inr));
  y += 1;
  doc.setDrawColor(100, 100, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.2);
  y += 5;
  row("Total Tax Liability", inr(breakdown.total_tax_inr), true);
  if (parseFloat(breakdown.tds_194s_credit_inr ?? "0") > 0) {
    row("TDS Credit (Section 194S)", `(${inr(breakdown.tds_194s_credit_inr)})`, false, true);
    y += 1;
    row("Tax Payable After TDS", inr(breakdown.tax_payable_after_tds_inr), true);
  }
  y += 4;
  line();

  if (input.proofTxHash) {
    section("ZK Proof (STARK via Starknet)");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Starknet TX:", margin, y);
    doc.text(input.proofTxHash, margin + 28, y);
    y += 6;
    if (input.ledgerCommitment) {
      doc.text("Ledger Commitment:", margin, y);
      doc.text(input.ledgerCommitment.slice(0, 42) + "...", margin + 42, y);
      y += 6;
    }
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    y += 2;
    line();
  }

  y += 2;
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const disclaimer =
    "This report is generated for informational purposes by ProofOS. It does not constitute " +
    "legal or financial advice. Please consult a qualified CA / tax professional before filing " +
    "your ITR. Calculations are based on Indian IT Act provisions for FY 2025-26 (AY 2026-27) " +
    "under the new tax regime (Section 115BAC). VDA taxation per Section 115BBH.";
  const lines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(lines, margin, y);

  return doc;
}

export function downloadTaxReportPdf(input: PdfReportInput): void {
  const doc = generateTaxReportPdf(input);
  const ts = new Date().toISOString().slice(0, 10);
  doc.save(`proofos-tax-report-${ts}.pdf`);
}

export function taxReportPdfBase64(input: PdfReportInput): string {
  const doc = generateTaxReportPdf(input);
  return doc.output("datauristring");
}
