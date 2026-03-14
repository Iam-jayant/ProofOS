// In-memory job store — replaces Arc<RwLock<HashMap<String, ProofJobStatus>>> from Rust
// Uses Node.js `global` to survive Next.js hot-reload in development.
// IMPORTANT: This does NOT persist across serverless lambda invocations on Vercel.
// For production, replace the Map with @vercel/kv (one-line change).

export type JobStatus = "pending" | "done" | "error";

export interface ProofJobResult {
  ledger_commitment: string;    // hex SHA256 of canonical serialized ledger
  total_tax_paisa: string;      // stringified BigInt (from TaxCommitted event)
  user_type_code: number;       // 0=Individual, 1=HUF, 2=Corporate
  used_44ada: boolean;
  proof: string;                // base64(JSON({ tx: starknetTxHash, commitment }))
  public_values: string;        // base64 encoded public values (commitment + tax)
  vk_hash: string;              // Starknet tx hash used as vk identifier
  starknet_tx_hash: string;     // raw Starknet tx hash for explorer link
}

export interface ProofJob {
  job_id: string;
  status: JobStatus;
  created_at: number;
  result?: ProofJobResult;
  error?: string;
}

// Use global to survive Next.js module hot-reload in dev
const globalWithJobs = global as typeof global & {
  __proofosJobStore?: Map<string, ProofJob>;
};

if (!globalWithJobs.__proofosJobStore) {
  globalWithJobs.__proofosJobStore = new Map<string, ProofJob>();
}

const store: Map<string, ProofJob> = globalWithJobs.__proofosJobStore;

export const jobStore = {
  set(job: ProofJob): void {
    store.set(job.job_id, job);
  },

  get(jobId: string): ProofJob | undefined {
    return store.get(jobId);
  },

  update(jobId: string, patch: Partial<ProofJob>): void {
    const existing = store.get(jobId);
    if (existing) {
      store.set(jobId, { ...existing, ...patch });
    }
  },

  has(jobId: string): boolean {
    return store.has(jobId);
  },
};
