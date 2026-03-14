import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { title?: string; markdownContent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, markdownContent } = body;
  if (!title || !markdownContent) {
    return NextResponse.json({ error: "title and markdownContent required" }, { status: 400 });
  }

  const privateKey = process.env.FILEVERSE_PRIVATE_KEY;
  const pimlicoKey = process.env.PIMLICO_API_KEY;
  const pinataJwt = process.env.PINATA_JWT;
  const pinataGateway = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
  const namespace = process.env.NEXT_PUBLIC_FILEVERSE_NAMESPACE ?? "proofos-reports";

  if (!privateKey || !pimlicoKey || !pinataJwt) {
    console.warn("[Fileverse] Missing FILEVERSE_PRIVATE_KEY / PIMLICO_API_KEY / PINATA_JWT");
    return NextResponse.json({ error: "Fileverse not configured", url: null }, { status: 503 });
  }

  try {
    const { Agent } = await import("@fileverse/agents");
    const { PinataStorageProvider } = await import("@fileverse/agents/storage");
    const { privateKeyToAccount } = await import("viem/accounts");

    const storageProvider = new PinataStorageProvider({
      jwt: pinataJwt,
      gateway: pinataGateway,
    });

    const agent = new Agent({
      chain: "gnosis",
      viemAccount: privateKeyToAccount(privateKey as `0x${string}`),
      pimlicoAPIKey: pimlicoKey,
      storageProvider,
    });

    await agent.setupStorage(namespace);
    const result = await agent.writeMarkdown(markdownContent, { title });

    const url = result.url ?? (result.ipfsHash ? `https://ddocs.new/ipfs/${result.ipfsHash}` : null);

    return NextResponse.json({
      success: true,
      url,
      ipfsHash: result.ipfsHash ?? null,
    });
  } catch (err) {
    console.error("[Fileverse] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fileverse upload failed" },
      { status: 500 },
    );
  }
}
