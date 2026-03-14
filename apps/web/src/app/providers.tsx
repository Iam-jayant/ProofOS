"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { SessionProvider } from "@/lib/session";
import { getConfig } from "@/lib/wagmi";
import type { ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";

// Fix 1: @starknet-react/core v3 uses StarknetConfig (NOT StarknetProvider)
import { StarknetConfig, jsonRpcProvider, argent, braavos } from "@starknet-react/core";
import { sepolia as starknetSepolia } from "@starknet-react/chains";

const starknetRpc = process.env.NEXT_PUBLIC_STARKNET_RPC_URL
  ?? "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";

const starknetConnectors = [argent(), braavos()];

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const config = getConfig();

  return (
    <StarknetConfig
      chains={[starknetSepolia]}
      provider={jsonRpcProvider({ rpc: () => ({ nodeUrl: starknetRpc }) })}
      connectors={starknetConnectors}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#8b5cf6",
              accentColorForeground: "white",
              borderRadius: "medium",
            })}
          >
            <SessionProvider>{children}</SessionProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </StarknetConfig>
  );
}
