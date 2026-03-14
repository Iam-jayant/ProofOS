# ProofOS

ProofOS is a Web3 tax computation and verification platform for India-focused crypto reporting.
It combines deterministic tax rules, STARK-based proof flow, and on-chain verification records.

## Problem

Crypto tax computation is difficult to trust and audit when it relies on opaque spreadsheets and manual bookkeeping.

Common issues:

- Multi-wallet transaction history is hard to aggregate and categorize.
- Indian tax logic (such as Section 115BBH, 44ADA, slab and surcharge rules) is easy to misapply.
- There is usually no tamper-evident proof that the published tax number came from the same ledger.

## Solution

ProofOS provides an end-to-end workflow:

1. Ingest and normalize wallet activity.
2. Apply deterministic Indian tax logic in software.
3. Generate a cryptographic proof path via Starknet.
4. Anchor verified tax records to a smart contract.
5. Export/share a certificate and verification metadata.

## Product Scope

- Wallet-based ledger sync (Base Sepolia transfer ingestion).
- Tax computation engine aligned to India-specific sections and rule bands.
- Proof generation and on-chain verification flow.
- Verification UI for checking and submitting proof artifacts.
- Report and certificate generation (including Fileverse integration where configured).
- ENS club workflows for grouped wallet operations.
- Oracle-backed live USD/INR and USD asset rate refresh for valuation inputs.

## Authorization and Trust Model

This project uses a technical authorization model backed by rules + cryptography + smart contracts.

### 1) Rule Authorization (Policy Layer)

Tax logic is encoded as deterministic formulas in code (not black-box AI output), including:

- Individual/HUF slab bands for AY 2026-27.
- Section 115BBH treatment for VDA gains and non-offsettable losses.
- Section 44ADA eligibility and presumptive treatment.
- Section 87A rebate and marginal relief handling.
- Surcharge and cess handling.
- Corporate regime options (including 115BAA path).

### 2) Proof Authorization (Computation Integrity Layer)

ProofOS generates and packages proof artifacts tied to ledger commitments and computed tax values.

### 3) On-Chain Authorization (Settlement Layer)

The `TaxVerifier` smart contract records verified outcomes after consuming Starknet L2 messages.
This creates a tamper-evident on-chain checkpoint for the computation outcome.

### 4) Evidence Authorization (Document Layer)

Certificates include cryptographic and transaction metadata so downstream reviewers can correlate:

- Ledger commitment
- Proof metadata
- Verification transaction references

Important: ProofOS is not a government e-filing portal and does not replace licensed professional advice.
It is a computation + verification system aligned to encoded tax rules.

## High-Level Architecture

### Frontend

- Next.js app router UI.
- Session-backed workflow for wallets, ledger review, tax, proof, and verification.

### API Routes

- `/api/transfers`: wallet transfer ingestion and normalization.
- `/api/tax`: deterministic tax breakdown generation.
- `/api/proofs` and `/api/proofs/[jobId]`: proof job lifecycle.
- `/api/proofs/[jobId]/certificate`: certificate generation and publish flow.
- `/api/oracle/rates`: live USD conversion feed for valuation inputs.
- `/api/ens/*`, `/api/ddocs/*`, `/api/fileverse/publish`, `/api/tax/advice`: optional integrations.

### Contracts and Verification

- Cairo-side logic emits message payloads.
- Ethereum-side `TaxVerifier` consumes Starknet messages and stores tax records.
- Verification events and records are queryable via contract reads.

## Repository Layout (Relevant)

- `apps/web`: web app and API routes.
- `contracts`: Solidity, Foundry scripts, and Starknet Cairo contracts.

## Environment Configuration

### Local Development

Copy and fill app envs:

```bash
cp .env.local.example .env.local
```

Use `.env.local.example` as source of truth for required and optional variables.

### Root vs App Env Files

- Root `.env.example`: contract/deployment script variables.
- `apps/web/.env.local.example`: web app variables for local/Vercel.

Do not commit real env files.

## Local Run

```bash
npm install
npm run dev
```

Build and verify:

```bash
npm run lint
npm run build
npm run start
```

## Deployment on Vercel (Monorepo)

### 1) Import and Root Directory

- Import the Git repository in Vercel.
- Set Root Directory to `apps/web`.

### 2) Build Settings

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: default Next.js output (or `.next` if prompted)

### 3) Required Environment Variables

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `ALCHEMY_API_KEY` (or `ALCHEMY_BASE_SEPOLIA_URL`)
- `NEXT_PUBLIC_CAIRO_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_TAX_VERIFIER_ADDRESS`

Recommended defaults:

- `NEXT_PUBLIC_API_URL=/api`
- `NEXT_PUBLIC_STARKNET_RPC_URL`
- `ENS_SUBGRAPH_URL`

Optional integrations:

- `ELSA_API_KEY`
- `FILEVERSE_API_KEY`
- `NEXT_PUBLIC_FILEVERSE_API_KEY`
- `FILEVERSE_PRIVATE_KEY`
- `PIMLICO_API_KEY`
- `PINATA_JWT`
- `PINATA_GATEWAY`
- `NEXT_PUBLIC_FILEVERSE_NAMESPACE`

### 4) Scope and Redeploy

Set vars for Production and Preview at minimum.
Trigger a fresh deploy after any env update.

## Security and Compliance Notes

- `NEXT_PUBLIC_*` variables are client-visible and must not hold secrets.
- Private keys and API secrets stay server-side only.
- This system encodes tax logic and verification evidence; filing responsibility remains with the taxpayer and advisor.

## Quick Checklist

- [ ] Root directory is `apps/web`
- [ ] Required env variables are set in Vercel
- [ ] Build passes locally with `npm run build`
- [ ] Secrets are not committed
- [ ] Contract addresses are set to intended network values
