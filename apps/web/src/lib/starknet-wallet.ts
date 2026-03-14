/**
 * Starknet wallet hooks — thin wrappers over @starknet-react/core v3.
 *
 * Fix 1: @starknet-react/core v3 exposes StarknetConfig (not StarknetProvider).
 * The hooks below use the v3 API:
 *   - useAccount()    → { account, address, status, isConnected }
 *   - useConnect()    → { connect, connectors }
 *   - useDisconnect() → { disconnect }
 *
 * Import in components: "use client" required as these rely on React context.
 */

"use client";

export {
  useAccount,
  useConnect,
  useDisconnect,
  useProvider,
  useNetwork,
} from "@starknet-react/core";
