"use client";

/**
 * StarknetConnectButton — isolated component used only in the proof-submission step.
 * Uses @starknet-react/core v3 hooks (Fix 1: useAccount / useConnect / useDisconnect).
 * Does NOT modify any existing UI component.
 */

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";

export function StarknetConnectButton() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          SN: {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
