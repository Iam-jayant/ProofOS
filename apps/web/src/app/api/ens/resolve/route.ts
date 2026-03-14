// Port of resolve_ens handler in crates/api/src/main.rs + crates/api/src/ens.rs
// Response shape must exactly match EnsResolveResponse in apps/web/src/lib/api.ts
// { subdomains: EnsSubdomain[] } where EnsSubdomain = { name, label, address: string | null }

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/49574/enssepolia/version/latest";

// ─── GraphQL query (same as Rust EnsResolver) ───────────────────────────────

const GET_SUBDOMAINS_QUERY = `
  query GetSubdomains($name: String!) {
    domains(where: { name: $name }) {
      name
      labelName
      resolvedAddress {
        id
      }
      subdomains(first: 100) {
        name
        labelName
        resolvedAddress {
          id
        }
      }
    }
  }
`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddressNode {
  id: string;
}

interface SubdomainNode {
  name: string | null;
  labelName: string | null;
  resolvedAddress: AddressNode | null;
}

interface DomainNode {
  name: string | null;
  labelName: string | null;
  resolvedAddress: AddressNode | null;
  subdomains: SubdomainNode[] | null;
}

interface GraphQLResponse {
  data?: { domains: DomainNode[] };
  errors?: { message: string }[];
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { root_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rootName = String(body.root_name ?? "").trim().toLowerCase();
  if (!rootName) {
    return NextResponse.json({ error: "Root name is required" }, { status: 400 });
  }

  const subgraphUrl =
    process.env.ENS_SUBGRAPH_URL ?? DEFAULT_SUBGRAPH_URL;

  let gqlResponse: GraphQLResponse;
  try {
    const res = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GET_SUBDOMAINS_QUERY,
        variables: { name: rootName },
      }),
    });

    if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
    gqlResponse = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to resolve ENS: ${msg}` },
      { status: 500 },
    );
  }

  if (gqlResponse.errors?.length) {
    return NextResponse.json(
      { error: `ENS subgraph error: ${gqlResponse.errors[0].message}` },
      { status: 500 },
    );
  }

  const subdomains: { name: string; label: string; address: string | null }[] =
    [];

  for (const domain of gqlResponse.data?.domains ?? []) {
    // Root domain with resolved address
    if (domain.name && domain.resolvedAddress) {
      subdomains.push({
        name: domain.name,
        label: domain.labelName ?? domain.name,
        address: domain.resolvedAddress.id,
      });
    }

    // Subdomains — same as Rust: include all, address may be null
    for (const sub of domain.subdomains ?? []) {
      if (sub.name) {
        subdomains.push({
          name: sub.name,
          label: sub.labelName ?? sub.name,
          address: sub.resolvedAddress?.id ?? null,
        });
      }
    }
  }

  return NextResponse.json({ subdomains });
}
