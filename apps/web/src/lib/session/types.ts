// Session state types for ProofOS

export type UserType = "individual" | "huf" | "corporate";
export type CorporateRegime = "115baa" | "regular";

export interface Wallet {
  id: string;
  address: string;
  label?: string;
  groupId?: string;
}

export interface WalletGroup {
  id: string;
  name: string;
  description?: string;
}

export type Category =
  | "income"
  | "gains"
  | "losses"
  | "fees"
  | "internal"
  | "unknown";

export type Direction = "in" | "out";

export interface LedgerRow {
  id: string;
  chainId: number;
  ownerWallet: string;
  txHash: string;
  blockTime: number;
  asset: string;
  amount: string;
  decimals: number;
  direction: Direction;
  counterparty?: string;
  category: Category;
  confidence: number;
  userOverride: boolean;
  costBasisInr?: string;
}

export interface CategoryOverride {
  ledgerRowId: string;
  category: Category;
}

export interface PriceEntry {
  asset: string;
  usdPrice: string;
}

export interface TaxSummary {
  totalTaxPaisa: number;
  breakdown: {
    vdaGains: number;
    vdaLosses: number;
    incomeFromVda: number;
    slabTax: number;
    flatTax: number;
  };
  computedAt: number;
}

export interface ProofArtifacts {
  ledgerCommitment: string; // hex encoded SHA256
  totalTaxPaisa: number;
  userTypeCode: number;
  used44ada: boolean;
  proof: string; // base64 encoded
  publicValues: string; // base64 encoded
  vkHash: string; // verification key hash
  note: string;
  generatedAt: number;
}

export interface SessionState {
  version: number;
  userType?: UserType;
  wallets: Wallet[];
  walletGroups: WalletGroup[];
  ledger: LedgerRow[];
  categoryOverrides: CategoryOverride[];
  prices: PriceEntry[];
  usdInrRate: string;
  use44ada: boolean;
  isSalaried: boolean;
  corporateRegime: CorporateRegime;
  tds194sInr: string;
  priorYearBusinessLossInr: string;
  taxSummary?: TaxSummary;
  proofArtifacts?: ProofArtifacts;
  createdAt: number;
  updatedAt: number;
}

export const CURRENT_SESSION_VERSION = 1;

export const createEmptySession = (): SessionState => ({
  version: CURRENT_SESSION_VERSION,
  userType: undefined,
  wallets: [],
  walletGroups: [],
  ledger: [],
  categoryOverrides: [],
  prices: [],
  usdInrRate: "83.00",
  use44ada: false,
  isSalaried: false,
  corporateRegime: "115baa",
  tds194sInr: "0",
  priorYearBusinessLossInr: "0",
  taxSummary: undefined,
  proofArtifacts: undefined,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
