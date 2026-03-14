import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";
import type { Config } from "wagmi";

let _config: Config | undefined;

export function getConfig(): Config {
  if (!_config) {
    _config = getDefaultConfig({
      appName: "ProofOS",
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
      chains: [baseSepolia],
      ssr: true,
    });
  }
  return _config;
}

// Contract addresses used by the app.
export const CONTRACTS = {
  taxVerifier: (process.env.NEXT_PUBLIC_TAX_VERIFIER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;
