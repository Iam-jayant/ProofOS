/**
 * Starknet integration for ProofOS
 *
 * Canonical ledger serialization:
 *   Each row encodes as exactly 34 bytes:
 *   [ u8 category | u128 amount_paisa (BE, 16 bytes) | u8 asset_type | u128 cost_basis_paisa (BE, 16 bytes) ]
 *   This must be byte-identical to serialize_ledger() in contracts/starknet/src/tax_verifier.cairo.
 */

import { RpcProvider, type AccountInterface, type InvokeFunctionResponse } from "starknet";
import type { ApiLedgerRow } from "./api";

const CATEGORY_CODES: Record<ApiLedgerRow["category"], number> = {
  income: 0,
  gains: 1,
  losses: 2,
  fees: 3,
  internal: 4,
  unknown: 5,
};

const ASSET_TYPE_CODES: Record<string, number> = {
  ETH: 0,
  ERC20: 1,
  ERC721: 2,
  ERC1155: 3,
};

export interface LedgerRowForCairo {
  category: ApiLedgerRow["category"];
  amount_paisa: bigint;
  cost_basis_paisa: bigint;
  asset_type: string;
  direction: "in" | "out";
}

export function serializeLedger(rows: LedgerRowForCairo[]): Uint8Array {
  const buf = new Uint8Array(rows.length * 34);
  let offset = 0;

  for (const row of rows) {
    buf[offset++] = CATEGORY_CODES[row.category] ?? 5;

    let amount = row.amount_paisa;
    for (let i = 15; i >= 0; i--) {
      buf[offset + i] = Number(amount & 0xffn);
      amount >>= 8n;
    }
    offset += 16;

    buf[offset++] = ASSET_TYPE_CODES[row.asset_type] ?? 1;

    let coa = row.cost_basis_paisa;
    for (let i = 15; i >= 0; i--) {
      buf[offset + i] = Number(coa & 0xffn);
      coa >>= 8n;
    }
    offset += 16;
  }

  return buf;
}

/**
 * Compute felt252 commitment using Cairo-compatible packing:
 * words[0..6] full u32 limbs + lower 27 bits of words[7].
 */
export async function computeLedgerCommitment(rows: LedgerRowForCairo[]): Promise<string> {
  const bytes = serializeLedger(rows);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);

  const view = new DataView(hashBuffer);
  const words: number[] = [];
  for (let i = 0; i < 8; i++) {
    words.push(view.getUint32(i * 4, false));
  }

  let commitment = 0n;
  for (let i = 0; i < 7; i++) {
    commitment = (commitment << 32n) + BigInt(words[i]);
  }
  commitment = (commitment << 27n) + BigInt(words[7] & 0x07ffffff);

  return "0x" + commitment.toString(16).padStart(63, "0");
}

export async function ledgerCommitment(rows: LedgerRowForCairo[]): Promise<string> {
  return computeLedgerCommitment(rows);
}

export const TAX_VERIFIER_ABI = [
  {
    type: "function",
    name: "verify_and_commit",
    inputs: [
      {
        name: "ledger_rows",
        type: "core::array::Array::<proofos_tax_verifier::TaxVerifier::LedgerRow>",
      },
      { name: "user_type", type: "core::integer::u8" },
      { name: "use_44ada", type: "core::bool" },
      { name: "is_salaried", type: "core::bool" },
      { name: "corporate_regime", type: "core::integer::u8" },
      { name: "prior_loss_paisa", type: "core::integer::u128" },
      { name: "tds_194s_paisa", type: "core::integer::u128" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "struct",
    name: "proofos_tax_verifier::TaxVerifier::LedgerRow",
    members: [
      { name: "category", type: "core::integer::u8" },
      { name: "amount_paisa", type: "core::integer::u128" },
      { name: "asset_type", type: "core::integer::u8" },
      { name: "cost_basis_paisa", type: "core::integer::u128" },
      { name: "direction", type: "core::integer::u8" },
    ],
  },
  {
    type: "event",
    name: "proofos_tax_verifier::TaxVerifier::TaxCommitted",
    kind: "struct",
    members: [
      { name: "ledger_commitment", type: "core::felt252", kind: "key" },
      { name: "tax_after_tds_paisa", type: "core::integer::u256", kind: "key" },
      { name: "user_type", type: "core::integer::u8", kind: "data" },
      { name: "used_44ada", type: "core::bool", kind: "data" },
      { name: "tds_194s_paisa", type: "core::integer::u128", kind: "data" },
      { name: "vda_losses_paisa", type: "core::integer::u128", kind: "data" },
      { name: "business_loss_cfy_paisa", type: "core::integer::u128", kind: "data" },
      { name: "surcharge_paisa", type: "core::integer::u128", kind: "data" },
      { name: "caller", type: "starknet::ContractAddress", kind: "data" },
    ],
  },
] as const;

function rowsToCalldata(rows: LedgerRowForCairo[]): string[] {
  const result: string[] = ["0x" + rows.length.toString(16)];
  for (const row of rows) {
    result.push("0x" + (CATEGORY_CODES[row.category] ?? 5).toString(16));
    result.push("0x" + row.amount_paisa.toString(16));
    result.push("0x" + (ASSET_TYPE_CODES[row.asset_type] ?? 1).toString(16));
    result.push("0x" + row.cost_basis_paisa.toString(16));
    result.push("0x" + (row.direction === "out" ? 1 : 0).toString(16));
  }
  return result;
}

export interface StarknetProofResult {
  ledger_commitment: string;
  total_tax_paisa: string;
  tax_after_tds_paisa: string;
  tds_194s_paisa: string;
  vda_losses_paisa: string;
  business_loss_cfy_paisa: string;
  surcharge_paisa: string;
  user_type_code: number;
  used_44ada: boolean;
  starknet_tx_hash: string;
}

interface StarknetEventLike {
  from_address?: string;
  keys?: string[];
  data?: string[];
}

const USER_TYPE_CODE: Record<string, number> = {
  individual: 0,
  huf: 1,
  corporate: 2,
};

export async function submitTaxProofToStarknet(
  account: AccountInterface,
  cairoAddress: string,
  rows: LedgerRowForCairo[],
  userType: string,
  use44ada: boolean,
  isSalaried: boolean,
  corporateRegime: "115baa" | "regular",
  priorYearBusinessLossInr: string,
  tds194sInr: string,
): Promise<StarknetProofResult> {
  const priorLossPaisa = BigInt(Math.floor((parseFloat(priorYearBusinessLossInr) || 0) * 100));
  const tds194sPaisa = BigInt(Math.floor((parseFloat(tds194sInr) || 0) * 100));
  const corporateRegimeCode = corporateRegime === "regular" ? 1 : 0;

  const calldata = [
    ...rowsToCalldata(rows),
    "0x" + (USER_TYPE_CODE[userType.toLowerCase()] ?? 0).toString(16),
    use44ada ? "0x1" : "0x0",
    isSalaried ? "0x1" : "0x0",
    "0x" + corporateRegimeCode.toString(16),
    "0x" + priorLossPaisa.toString(16),
    "0x" + tds194sPaisa.toString(16),
  ];

  const response: InvokeFunctionResponse = await account.execute([
    {
      contractAddress: cairoAddress,
      entrypoint: "verify_and_commit",
      calldata,
    },
  ]);

  const txHash = response.transaction_hash;

  const rpcUrl =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STARKNET_RPC_URL : undefined) ??
    "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const receipt = await provider.waitForTransaction(txHash);

  const normalizedCairo = cairoAddress.toLowerCase().replace(/^0x0*/, "0x");
  const receiptWithEvents = receipt as { events?: StarknetEventLike[] };
  const events = receiptWithEvents.events ?? [];

  const taxEvent = events.find((event) => {
    const addr = (event.from_address ?? "").toLowerCase().replace(/^0x0*/, "0x");
    return addr === normalizedCairo;
  });

  if (!taxEvent || !Array.isArray(taxEvent.data) || taxEvent.data.length < 6) {
    throw new Error(`TaxCommitted event not found in tx ${txHash}`);
  }

  const keys: string[] = taxEvent.keys ?? [];
  const rawCommitment = keys[1] ?? "0x0";
  const taxLow = BigInt(keys[2] ?? "0x0");
  const taxHigh = BigInt(keys[3] ?? "0x0");
  const taxAfterTdsPaisa = (taxHigh * (2n ** 128n) + taxLow).toString();
  const used44adaEffective = BigInt(taxEvent.data[1] ?? "0x0") !== 0n;

  const tdsPaisa = BigInt(taxEvent.data[2] ?? "0x0").toString();
  const vdaLossesPaisa = BigInt(taxEvent.data[3] ?? "0x0").toString();
  const businessLossCfyPaisa = BigInt(taxEvent.data[4] ?? "0x0").toString();
  const surchargePaisa = BigInt(taxEvent.data[5] ?? "0x0").toString();

  const commitment = "0x" + BigInt(rawCommitment).toString(16).padStart(64, "0");

  return {
    ledger_commitment: commitment,
    total_tax_paisa: taxAfterTdsPaisa,
    tax_after_tds_paisa: taxAfterTdsPaisa,
    tds_194s_paisa: tdsPaisa,
    vda_losses_paisa: vdaLossesPaisa,
    business_loss_cfy_paisa: businessLossCfyPaisa,
    surcharge_paisa: surchargePaisa,
    user_type_code: USER_TYPE_CODE[userType.toLowerCase()] ?? 0,
    used_44ada: used44adaEffective,
    starknet_tx_hash: txHash,
  };
}
