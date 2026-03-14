// API client for ProofOS routes

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface ApiLedgerRow {
  chain_id: number;
  owner_wallet: string;
  tx_hash: string;
  block_time: number;
  asset: string;
  amount: string;
  decimals: number;
  direction: "in" | "out";
  counterparty: string | null;
  category: "income" | "gains" | "losses" | "fees" | "internal" | "unknown";
  confidence: number;
  user_override: boolean;
  cost_basis_inr?: string;
}

export interface WalletCount {
  wallet: string;
  count: number;
}

export interface TransfersResponse {
  ledger: ApiLedgerRow[];
  wallet_counts: WalletCount[];
}

export interface ApiError {
  error: string;
}

export async function fetchTransfers(wallets: string[]): Promise<TransfersResponse> {
  const response = await fetch(`${API_BASE}/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wallets }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Failed to fetch transfers");
  }

  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Tax calculation types
export interface PriceEntry {
  asset: string;
  usd_price: string;
}

export interface TaxBreakdown {
  professional_income_inr: string;
  standard_deduction_inr: string;
  current_year_business_loss_inr: string;
  taxable_professional_income_inr: string;
  vda_gains_gross_inr: string;
  total_cost_basis_inr: string;
  fees_as_coa_inr: string;
  net_vda_gains_inr: string;
  vda_losses_inr: string;
  professional_tax_inr: string;
  surcharge_inr: string;
  section_87a_rebate_inr: string;
  marginal_relief_inr: string;
  vda_tax_inr: string;
  cess_inr: string;
  total_tax_inr: string;
  tds_194s_credit_inr: string;
  tax_payable_after_tds_inr: string;
  carry_forward_loss_remaining_inr: string;
  loss_carry_forward_note: string;
  warnings: string[];
}

export interface TaxResponse {
  breakdown: TaxBreakdown;
}

export interface TaxRequest {
  user_type: string;
  ledger: ApiLedgerRow[];
  prices: PriceEntry[];
  usd_inr_rate: string;
  use_44ada: boolean;
  tds_194s_inr?: string;
  prior_year_business_loss_inr?: string;
  is_salaried?: boolean;
  corporate_regime?: "115baa" | "regular";
}

export async function calculateTax(request: TaxRequest): Promise<TaxResponse> {
  const response = await fetch(`${API_BASE}/tax`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Failed to calculate tax");
  }

  return response.json();
}

// Proof generation types
export interface ProofRequest {
  user_type: string;
  ledger: ApiLedgerRow[];
  prices: PriceEntry[];
  usd_inr_rate: string;
  use_44ada: boolean;
  tds_194s_inr?: string;
  prior_year_business_loss_inr?: string;
  is_salaried?: boolean;
  corporate_regime?: "115baa" | "regular";
}

export interface ProofResult {
  ledger_commitment: string;
  total_tax_paisa: number;
  user_type_code: number;
  used_44ada: boolean;
  proof: string;
  public_values: string;
  vk_hash: string;
}

export interface ProofSubmitResponse {
  job_id: string;
}

export type ProofJobStatus =
  | { status: "pending" }
  | { status: "done"; result: ProofResult }
  | { status: "error"; error: string };

export interface ProofStatusResponse {
  job_id: string;
  status: "pending" | "done" | "error";
  result?: ProofResult;
  error?: string;
}

// Submit a proof job (returns immediately with job_id)
export async function submitProofJob(request: ProofRequest): Promise<string> {
  const response = await fetch(`${API_BASE}/proofs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Failed to submit proof job");
  }

  const data: ProofSubmitResponse = await response.json();
  return data.job_id;
}

// Check proof job status
export async function getProofStatus(jobId: string): Promise<ProofStatusResponse> {
  const response = await fetch(`${API_BASE}/proofs/${jobId}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Failed to get proof status");
  }

  return response.json();
}

// Poll for proof completion (with callback for status updates)
export async function generateProofWithPolling(
  request: ProofRequest,
  onStatusUpdate?: (status: "pending" | "done" | "error", elapsedSeconds: number) => void,
  pollIntervalMs: number = 5000
): Promise<ProofResult> {
  // Submit the job
  const jobId = await submitProofJob(request);

  const startTime = Date.now();

  // Poll until done
  while (true) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const statusResponse = await getProofStatus(jobId);

    if (statusResponse.status === "done" && statusResponse.result) {
      onStatusUpdate?.("done", elapsedSeconds);
      return statusResponse.result;
    }

    if (statusResponse.status === "error") {
      onStatusUpdate?.("error", elapsedSeconds);
      throw new Error(statusResponse.error || "Proof generation failed");
    }

    // Still pending
    onStatusUpdate?.("pending", elapsedSeconds);

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// ENS resolution types
export interface EnsSubdomain {
  name: string;
  label: string;
  address: string | null;
}

export interface EnsResolveResponse {
  subdomains: EnsSubdomain[];
}

export async function resolveEnsSubdomains(rootName: string): Promise<EnsResolveResponse> {
  const response = await fetch(`${API_BASE}/ens/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ root_name: rootName }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Failed to resolve ENS subdomains");
  }

  return response.json();
}

export interface OracleRatesResponse {
  source: string;
  usd_inr: number;
  asset_usd_prices: Record<string, string>;
  unsupported_assets: string[];
  updated_at: string;
}

export async function fetchOracleRates(assets: string[]): Promise<OracleRatesResponse> {
  if (assets.length === 0) {
    throw new Error("No assets provided for oracle pricing");
  }

  const params = new URLSearchParams({
    assets: assets.join(","),
  });

  const response = await fetch(`${API_BASE}/oracle/rates?${params.toString()}`);

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ error: "Failed to fetch oracle rates" }));
    throw new Error(error.error || "Failed to fetch oracle rates");
  }

  return response.json();
}
