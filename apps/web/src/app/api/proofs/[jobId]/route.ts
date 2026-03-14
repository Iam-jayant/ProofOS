// Port of get_proof_status handler in crates/api/src/main.rs
// GET  → { job_id, status, result? } — matches ProofStatusResponse in api.ts
// PATCH → accepts { result } or { error } from the frontend after Starknet tx succeeds
//         The frontend calls this to update the job once ACCEPTED_ON_L2

import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/job-store";
import type { ProofJobResult } from "@/lib/job-store";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

// ─── GET /api/proofs/[jobId] ─────────────────────────────────────────────────

export async function GET(_req: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: `Job not found: ${jobId}` },
      { status: 404 },
    );
  }

  // Response shape matches ProofStatusResponse in api.ts exactly:
  // { job_id, status, result?, error? }
  // ProofResult in api.ts: { ledger_commitment, total_tax_paisa, user_type_code,
  //                          used_44ada, proof, public_values, vk_hash }
  return NextResponse.json({
    job_id: job.job_id,
    status: job.status,
    ...(job.result ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
  });
}

// ─── PATCH /api/proofs/[jobId] ───────────────────────────────────────────────
// Called by the frontend after submitTaxProof() resolves (ACCEPTED_ON_L2 confirmed)

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  if (!jobStore.has(jobId)) {
    return NextResponse.json(
      { error: `Job not found: ${jobId}` },
      { status: 404 },
    );
  }

  let body: { result?: ProofJobResult; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.result) {
    jobStore.update(jobId, { status: "done", result: body.result });
  } else if (body.error) {
    jobStore.update(jobId, { status: "error", error: body.error });
  } else {
    return NextResponse.json(
      { error: "Body must contain result or error" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
