"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Dynamically import providers with SSR disabled to avoid WalletConnect localStorage issues
const ProvidersInner = dynamic(
  () => import("./providers").then((mod) => mod.Providers),
  { ssr: false }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <ProvidersInner>{children}</ProvidersInner>;
}
