import { CONTRACTS } from "./wagmi";

export const taxVerifierAbi = [
  {
    type: "function",
    name: "verifyTaxProof",
    inputs: [
      { name: "proofBytes", type: "bytes" },
      { name: "publicValues", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "ledgerCommitment", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTaxRecord",
    inputs: [{ name: "ledgerCommitment", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "totalTaxPaisa", type: "uint256" },
          { name: "taxAfterTdsPaisa", type: "uint256" },
          { name: "tds194sPaisa", type: "uint256" },
          { name: "vdaLossesPaisa", type: "uint256" },
          { name: "businessLossCfyPaisa", type: "uint256" },
          { name: "surchargePaisa", type: "uint256" },
          { name: "userType", type: "uint8" },
          { name: "used44ada", type: "bool" },
          { name: "verifiedAt", type: "uint256" },
          { name: "verifiedBy", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "taxZkVkey",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TaxProofVerified",
    inputs: [
      { name: "ledgerCommitment", type: "bytes32", indexed: true },
      { name: "taxAfterTdsPaisa", type: "uint256", indexed: false },
      { name: "tds194sPaisa", type: "uint256", indexed: false },
      { name: "userType", type: "uint8", indexed: false },
      { name: "used44ada", type: "bool", indexed: false },
      { name: "verifiedBy", type: "address", indexed: true },
    ],
  },
] as const;

export const taxVerifierConfig = {
  address: CONTRACTS.taxVerifier,
  abi: taxVerifierAbi,
} as const;
