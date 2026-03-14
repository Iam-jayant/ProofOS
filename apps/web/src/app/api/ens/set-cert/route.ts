// ENS set-cert — write the STARK proof certificate to an ENS text record
// Bounty: ENS ($2k track)
//
// POST /api/ens/set-cert
// Body: { name: string, commitment: string, tx_hash: string, total_tax_paisa: string }
// Response: { success: true }
//
// This route returns the ENS PublicResolver.setText calldata so the user's
// *browser wallet* (via wagmi writeContract) can sign the actual transaction.
// The server never touches a private key.
//
// The text record key is "proofos.tax-cert.v1".
// Value format: "commitment=0x…;tx=0x…;tax=12345"

import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData } from "viem";

// ENS PublicResolver ABI (only setText)
const PUBLIC_RESOLVER_ABI = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node",  type: "bytes32" },
      { name: "key",   type: "string"  },
      { name: "value", type: "string"  },
    ],
    outputs: [],
  },
] as const;

// ENS PublicResolver on Ethereum Sepolia
const SEPOLIA_PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const TEXT_RECORD_KEY = "proofos.tax-cert.v1";

interface SetCertRequest {
  name:            string;
  commitment:      string;
  tx_hash:         string;
  total_tax_paisa: string;
  node:            string; // bytes32 ENS namehash — computed client-side
}

export async function POST(req: NextRequest) {
  let body: SetCertRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, commitment, tx_hash, total_tax_paisa, node } = body;

  if (!name || !commitment || !tx_hash || !total_tax_paisa || !node) {
    return NextResponse.json(
      { error: "name, commitment, tx_hash, total_tax_paisa, node are required" },
      { status: 400 }
    );
  }

  // Validate node is bytes32 (66-char hex)
  if (!/^0x[0-9a-fA-F]{64}$/.test(node)) {
    return NextResponse.json({ error: "node must be a 0x-prefixed bytes32 hex string" }, { status: 400 });
  }

  // Build the text record value
  const value = `commitment=${commitment};tx=${tx_hash};tax=${total_tax_paisa}`;

  // Encode setText calldata — returned to the frontend for wallet signing
  const calldata = encodeFunctionData({
    abi: PUBLIC_RESOLVER_ABI,
    functionName: "setText",
    args: [node as `0x${string}`, TEXT_RECORD_KEY, value],
  });

  return NextResponse.json({
    to:       SEPOLIA_PUBLIC_RESOLVER,
    calldata,
    key:      TEXT_RECORD_KEY,
    value,
  });
}
