// Port of calculate_tax_endpoint in crates/api/src/main.rs
// Response shape must exactly match TaxResponse in apps/web/src/lib/api.ts

import { NextRequest, NextResponse } from "next/server";
import { calculateTax, type TaxInput, type LedgerRow, type PriceEntry } from "@/lib/tax";

export async function POST(req: NextRequest) {
  let body: {
    user_type?: unknown;
    ledger?: unknown;
    prices?: unknown;
    usd_inr_rate?: unknown;
    use_44ada?: unknown;
    tds_194s_inr?: unknown;
    prior_year_business_loss_inr?: unknown;
    is_salaried?: unknown;
    corporate_regime?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userTypeRaw = String(body.user_type ?? "");
  if (!["individual", "huf", "corporate"].includes(userTypeRaw)) {
    return NextResponse.json(
      { error: `Invalid user type: ${userTypeRaw}` },
      { status: 400 },
    );
  }

  const input: TaxInput = {
    user_type: userTypeRaw as TaxInput["user_type"],
    wallets: [], // not needed for calculation — same comment as Rust
    ledger: (body.ledger as LedgerRow[]) ?? [],
    prices: (body.prices as PriceEntry[]) ?? [],
    usd_inr_rate: String(body.usd_inr_rate ?? "83.0"),
    use_44ada: Boolean(body.use_44ada),
    tds_194s_inr: body.tds_194s_inr == null ? undefined : String(body.tds_194s_inr),
    prior_year_business_loss_inr:
      body.prior_year_business_loss_inr == null
        ? undefined
        : String(body.prior_year_business_loss_inr),
    is_salaried: Boolean(body.is_salaried),
    corporate_regime:
      body.corporate_regime === "regular" ? "regular" : "115baa",
  };

  const breakdown = calculateTax(input);

  return NextResponse.json({ breakdown });
}
