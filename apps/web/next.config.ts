import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set turbopack root to silence the workspace root warning
  turbopack: {
    root: __dirname,
  },
  // Transpile wallet packages for SSR compatibility
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "@walletconnect/sign-client",
  ],
};

export default nextConfig;
