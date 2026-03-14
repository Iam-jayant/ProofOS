// Port of submit_proof handler in crates/api/src/main.rs
// Response: { job_id: string } — matches ProofSubmitResponse in api.ts
// The actual Starknet transaction is submitted by the USER's wallet (client-side starknet.ts).
// This route only creates the pending job record.

import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/job-store";
import { randomUUID } from "crypto";

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

  // Generate job ID (Rust used format!("{:x}", rand::random::<u64>()) — UUID is fine here)
  const jobId = randomUUID();

  // Store job as pending
  jobStore.set({
    job_id: jobId,
    status: "pending",
    created_at: Date.now(),
  });

  return NextResponse.json({ job_id: jobId });
}
