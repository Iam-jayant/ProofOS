"use client";

import { EncryptedText } from "@/components/ui/encrypted-text";
import { FloatingDock } from "@/components/ui/floating-dock";
import { Spotlight } from "@/components/ui/spotlight";
import { SparklesCore } from "@/components/ui/sparkles";
import { FlickerText } from "@/components/ui/gradient-text";
import {
  IconHome,
  IconApps,
  IconShieldCheck,
  IconWallet,
  IconCalculator,
  IconWorld,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";

const dockItems = [
  {
    title: "Home",
    icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/",
  },
  {
    title: "App",
    icon: <IconApps className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/app",
  },
  {
    title: "Club",
    icon: <IconUsers className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/club",
  },
  {
    title: "Verify",
    icon: <IconShieldCheck className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
    href: "/verify",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-black antialiased relative overflow-hidden">
      {/* Spotlight effect */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

      {/* Floating dock navigation */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <FloatingDock items={dockItems} />
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo / Title with Sparkles */}
        <div className="relative h-48 w-full max-w-4xl flex flex-col items-center justify-center">
          {/* Sparkles background */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <SparklesCore
              background="transparent"
              minSize={0.6}
              maxSize={1.4}
              particleDensity={100}
              className="w-full h-full"
              particleColor="#FFFFFF"
            />
          </div>

          {/* Title */}
          <FlickerText text="ProofOS" className="relative z-10" />
        </div>

        {/* Tagline */}
        <div className="mt-2 text-center">
          <p className="text-xl md:text-2xl text-neutral-400">
            <EncryptedText
              text="Prove your taxes with privacy"
              className="text-neutral-300"
            />
          </p>
        </div>

        {/* Description */}
        <p className="mt-8 max-w-2xl text-center text-neutral-500 text-sm md:text-base">
          Manage your crypto club with ENS, analyze on-chain activity, calculate tax liability,
          and generate zero-knowledge proofs that verify your calculations without
          revealing your financial data.
        </p>

        {/* Compare section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full px-4">
          {/* Normal ledger */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="text-lg font-semibold text-neutral-200 mb-4">
              Traditional Approach
            </h3>
            <div className="space-y-2 text-sm text-neutral-400">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span>Transaction 1</span>
                <span className="text-green-500">+2.5 ETH</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span>Transaction 2</span>
                <span className="text-red-500">-1.0 ETH</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span>Transaction 3</span>
                <span className="text-green-500">+5,000 USDC</span>
              </div>
              <div className="flex justify-between pt-2 text-neutral-300">
                <span>Tax Owed</span>
                <span>₹45,000</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-red-400">
              All transaction details visible to verifier
            </p>
          </div>

          {/* ZK ledger */}
          <div className="rounded-2xl border border-green-900/50 bg-green-950/20 p-6">
            <h3 className="text-lg font-semibold text-neutral-200 mb-4">
              With ProofOS
            </h3>
            <div className="space-y-2 text-sm text-neutral-400">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="blur-sm select-none">Transaction 1</span>
                <span className="blur-sm select-none">+2.5 ETH</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="blur-sm select-none">Transaction 2</span>
                <span className="blur-sm select-none">-1.0 ETH</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="blur-sm select-none">Transaction 3</span>
                <span className="blur-sm select-none">+5,000 USDC</span>
              </div>
              <div className="flex justify-between pt-2 text-neutral-300">
                <span>Tax Owed</span>
                <span>₹45,000</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-green-400">
              ZK proof verifies calculation without exposing data
            </p>
          </div>
        </div>

        {/* ENS Club Hub Section */}
        <div className="mt-16 max-w-4xl w-full px-4">
          <div className="rounded-2xl border border-purple-900/50 bg-gradient-to-br from-purple-950/30 to-neutral-900/50 p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <IconUsers className="w-8 h-8 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-neutral-100 mb-2">
                  ENS Club Hub
                </h3>
                <p className="text-neutral-400 mb-4">
                  Use ENS subdomains as your organizational membership registry. Create clubs like{" "}
                  <code className="text-purple-400 bg-purple-950/50 px-1.5 py-0.5 rounded">family.eth</code>{" "}
                  and add members as subdomains like{" "}
                  <code className="text-purple-400 bg-purple-950/50 px-1.5 py-0.5 rounded">alice.family.eth</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <IconWorld className="w-4 h-4 text-purple-400" />
                    <span>Register ENS domains</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <IconUsers className="w-4 h-4 text-purple-400" />
                    <span>Create member subdomains</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <IconCalculator className="w-4 h-4 text-purple-400" />
                    <span>One-click tax sync</span>
                  </div>
                </div>
                <Link
                  href="/club"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                >
                  <IconUsers className="w-4 h-4" />
                  Explore Club Hub
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full px-4">
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
              <IconUsers className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="font-medium text-neutral-200 mb-2">ENS Clubs</h4>
            <p className="text-sm text-neutral-500">
              Manage DAOs, families, or investment clubs using ENS subdomains as membership.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
              <IconWallet className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="font-medium text-neutral-200 mb-2">Multi-Wallet</h4>
            <p className="text-sm text-neutral-500">
              Import wallets by address or resolve all members from an ENS root name.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
              <IconCalculator className="w-5 h-5 text-amber-400" />
            </div>
            <h4 className="font-medium text-neutral-200 mb-2">Indian Tax Rules</h4>
            <p className="text-sm text-neutral-500">
              Section 115BBH (30% VDA), Section 115BAC slabs, and Section 44ADA presumptive.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
              <IconShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="font-medium text-neutral-200 mb-2">ZK Proofs</h4>
            <p className="text-sm text-neutral-500">
              SP1 zkVM proofs verify your tax calculation on-chain without revealing data.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/app"
          className="mt-16 px-8 py-3 rounded-full bg-white text-black font-medium hover:bg-neutral-200 transition-colors"
        >
          Enter App
        </Link>

        {/* Footer */}
        <div className="mt-16 mb-24 text-center text-xs text-neutral-600">
          <p className="mb-2">Built at EthMumbai 2026</p>
          <p className="flex items-center justify-center gap-2">
            Powered by
            <a href="https://succinct.xyz" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline">SP1 zkVM</a>
            +
            <a href="https://alchemy.com" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline">Alchemy</a>
            +
            <a href="https://ens.domains" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline">ENS</a>
          </p>
        </div>
      </div>
    </div>
  );
}
