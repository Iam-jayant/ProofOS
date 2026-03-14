"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther, keccak256, toBytes, concat, numberToBytes } from "viem";
import { FloatingDock } from "@/components/ui/floating-dock";
import { Spotlight } from "@/components/ui/spotlight";
import { SparklesCore } from "@/components/ui/sparkles";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { HoverCard3D } from "@/components/ui/card-3d";
import { resolveEnsSubdomains, type EnsSubdomain } from "@/lib/api";
import {
  ENS_CONTRACTS,
  ethRegistrarControllerConfig,
} from "@/lib/ens-contracts";
import {
  IconHome,
  IconApps,
  IconShieldCheck,
  IconUsers,
  IconSearch,
  IconLoader2,
  IconArrowRight,
  IconUsersGroup,
  IconWallet,
  IconLink,
  IconPlus,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconClock,
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

const useCases = [
  {
    icon: <IconUsersGroup className="w-8 h-8 text-purple-400" />,
    title: "Family Offices",
    description: "Manage all family member wallets under one ENS root",
  },
  {
    icon: <IconWallet className="w-8 h-8 text-blue-400" />,
    title: "DAOs & Clubs",
    description: "Organize treasury and member wallets as subdomains",
  },
  {
    icon: <IconLink className="w-8 h-8 text-emerald-400" />,
    title: "Investment Groups",
    description: "Track portfolio across multiple wallets with one lookup",
  },
];

// Generate a random secret for the commitment
function generateSecret(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

// Registration duration: 1 year in seconds
const ONE_YEAR_SECONDS = BigInt(365 * 24 * 60 * 60);

interface CreateClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (domain: string) => void;
}

type RegistrationStep = "input" | "checking" | "commit" | "waiting" | "register" | "success";

function CreateClubModal({ isOpen, onClose, onSuccess }: CreateClubModalProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [name, setName] = useState("");
  const [step, setStep] = useState<RegistrationStep>("input");
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [commitment, setCommitment] = useState<`0x${string}` | null>(null);
  const [waitEndTime, setWaitEndTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Check if name is available
  const { data: isAvailable, isLoading: checkingAvailability } = useReadContract({
    ...ethRegistrarControllerConfig,
    functionName: "available",
    args: name.length >= 3 ? [name.toLowerCase()] : undefined,
    query: {
      enabled: name.length >= 3 && step === "input",
    },
  });

  // Get rent price
  const { data: rentPrice } = useReadContract({
    ...ethRegistrarControllerConfig,
    functionName: "rentPrice",
    args: name.length >= 3 ? [name.toLowerCase(), ONE_YEAR_SECONDS] : undefined,
    query: {
      enabled: name.length >= 3,
    },
  });

  // Get min commitment age
  const { data: minCommitmentAge } = useReadContract({
    ...ethRegistrarControllerConfig,
    functionName: "minCommitmentAge",
    query: {
      enabled: true,
    },
  });

  // Make commitment (read-only to compute hash)
  const { data: commitmentHash } = useReadContract({
    ...ethRegistrarControllerConfig,
    functionName: "makeCommitment",
    args: secret && address ? [
      name.toLowerCase(),
      address,
      ONE_YEAR_SECONDS,
      secret,
      ENS_CONTRACTS.resolver,
      [],
      false,
      0,
    ] : undefined,
    query: {
      enabled: !!secret && !!address && step === "commit",
    },
  });

  // Commit transaction
  const { writeContract: writeCommit, data: commitTxHash, isPending: commitPending, error: commitError, reset: resetCommit } = useWriteContract();

  const { isLoading: commitConfirming, isSuccess: commitSuccess } = useWaitForTransactionReceipt({
    hash: commitTxHash,
  });

  // Register transaction
  const { writeContract: writeRegister, data: registerTxHash, isPending: registerPending, error: registerError, reset: resetRegister } = useWriteContract();

  const { isLoading: registerConfirming, isSuccess: registerSuccess } = useWaitForTransactionReceipt({
    hash: registerTxHash,
  });

  // Update commitment hash when available
  useEffect(() => {
    if (commitmentHash && step === "commit") {
      setCommitment(commitmentHash as `0x${string}`);
    }
  }, [commitmentHash, step]);

  // Handle commit success - start waiting period
  useEffect(() => {
    if (commitSuccess && minCommitmentAge) {
      const waitTime = Number(minCommitmentAge) + 5; // Add 5 second buffer
      setWaitEndTime(Date.now() + waitTime * 1000);
      setStep("waiting");
    }
  }, [commitSuccess, minCommitmentAge]);

  // Countdown timer
  useEffect(() => {
    if (step !== "waiting" || !waitEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((waitEndTime - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setStep("register");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, waitEndTime]);

  // Handle register success
  useEffect(() => {
    if (registerSuccess) {
      setStep("success");
      setTimeout(() => {
        onSuccess(`${name.toLowerCase()}.eth`);
        router.push(`/club/${encodeURIComponent(`${name.toLowerCase()}.eth`)}`);
      }, 2000);
    }
  }, [registerSuccess, name, onSuccess, router]);

  const handleStartRegistration = () => {
    if (!isAvailable || !address) return;

    const newSecret = generateSecret();
    setSecret(newSecret);
    setStep("commit");
    setError(null);
  };

  const handleCommit = () => {
    if (!commitment) return;

    writeCommit({
      ...ethRegistrarControllerConfig,
      functionName: "commit",
      args: [commitment],
    });
  };

  const handleRegister = () => {
    if (!secret || !address || !rentPrice) return;

    const totalPrice = (rentPrice as { base: bigint; premium: bigint }).base +
                       (rentPrice as { base: bigint; premium: bigint }).premium;

    // Add 10% buffer for price fluctuations
    const priceWithBuffer = (totalPrice * BigInt(110)) / BigInt(100);

    writeRegister({
      ...ethRegistrarControllerConfig,
      functionName: "register",
      args: [
        name.toLowerCase(),
        address,
        ONE_YEAR_SECONDS,
        secret,
        ENS_CONTRACTS.resolver,
        [],
        false,
        0,
      ],
      value: priceWithBuffer,
    });
  };

  const handleClose = () => {
    setName("");
    setStep("input");
    setSecret(null);
    setCommitment(null);
    setWaitEndTime(null);
    setCountdown(0);
    setError(null);
    resetCommit();
    resetRegister();
    onClose();
  };

  const totalPrice = rentPrice
    ? (rentPrice as { base: bigint; premium: bigint }).base + (rentPrice as { base: bigint; premium: bigint }).premium
    : BigInt(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={handleClose} />
      <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Create New Club</h3>
          <button onClick={handleClose} className="p-1 hover:bg-neutral-800 rounded-lg">
            <IconX className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {!isConnected ? (
          <div className="text-center py-8">
            <IconWallet className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400 mb-4">Connect your wallet to register an ENS domain</p>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  <IconWallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : step === "success" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <IconCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Club Created!</h4>
            <p className="text-neutral-400 text-sm">
              {name.toLowerCase()}.eth is now yours
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center mb-6">
              {["Name", "Commit", "Wait", "Register"].map((label, idx) => {
                const stepIdx = ["input", "commit", "waiting", "register"].indexOf(step);
                const isActive = idx <= stepIdx;
                const isCurrent = idx === stepIdx;
                return (
                  <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                      isActive
                        ? isCurrent
                          ? "bg-purple-600 text-white"
                          : "bg-purple-600/50 text-purple-200"
                        : "bg-neutral-800 text-neutral-500"
                    }`}>
                      {idx + 1}
                    </div>
                    {idx < 3 && (
                      <div className={`flex-1 h-0.5 mx-2 ${isActive && idx < stepIdx ? "bg-purple-600/50" : "bg-neutral-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {step === "input" && (
              <>
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">
                    Club Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
                      placeholder="myclub"
                      className="flex-1 px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600"
                      minLength={3}
                    />
                    <span className="text-neutral-500">.eth</span>
                  </div>
                  {name.length > 0 && name.length < 3 && (
                    <p className="text-xs text-amber-400 mt-1">Name must be at least 3 characters</p>
                  )}
                </div>

                {name.length >= 3 && (
                  <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-400">Availability</span>
                      {checkingAvailability ? (
                        <IconLoader2 className="w-4 h-4 animate-spin text-neutral-400" />
                      ) : isAvailable ? (
                        <span className="text-sm text-emerald-400 flex items-center gap-1">
                          <IconCheck className="w-4 h-4" /> Available
                        </span>
                      ) : (
                        <span className="text-sm text-red-400 flex items-center gap-1">
                          <IconX className="w-4 h-4" /> Taken
                        </span>
                      )}
                    </div>
                    {rentPrice && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Price (1 year)</span>
                        <span className="text-sm text-white font-mono">
                          {formatEther(totalPrice)} ETH
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleStartRegistration}
                  disabled={!isAvailable || name.length < 3}
                  className="w-full py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Start Registration
                </button>
              </>
            )}

            {step === "commit" && (
              <>
                <div className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <h4 className="text-white font-medium mb-2">Step 1: Commit</h4>
                  <p className="text-sm text-neutral-400">
                    Submit a commitment to prevent front-running. This reserves your name.
                  </p>
                </div>

                {(commitError || error) && (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm flex items-start gap-2">
                    <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="break-all">{(commitError as Error)?.message || error}</span>
                  </div>
                )}

                <button
                  onClick={handleCommit}
                  disabled={!commitment || commitPending || commitConfirming}
                  className="w-full py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
                >
                  {commitPending ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Confirm in Wallet...
                    </>
                  ) : commitConfirming ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Submit Commitment"
                  )}
                </button>
              </>
            )}

            {step === "waiting" && (
              <>
                <div className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700 text-center">
                  <IconClock className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <h4 className="text-white font-medium mb-2">Step 2: Wait Period</h4>
                  <p className="text-sm text-neutral-400 mb-4">
                    Please wait for the commitment to mature. This prevents front-running attacks.
                  </p>
                  <div className="text-4xl font-mono text-purple-400">
                    {countdown}s
                  </div>
                </div>
              </>
            )}

            {step === "register" && (
              <>
                <div className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
                  <h4 className="text-white font-medium mb-2">Step 3: Register</h4>
                  <p className="text-sm text-neutral-400 mb-3">
                    Complete registration by paying the registration fee.
                  </p>
                  <div className="flex items-center justify-between p-2 rounded bg-neutral-900">
                    <span className="text-neutral-400">Total Cost</span>
                    <span className="font-mono text-white">{formatEther(totalPrice)} ETH</span>
                  </div>
                </div>

                {registerError && (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm flex items-start gap-2">
                    <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="break-all">{(registerError as Error)?.message}</span>
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={registerPending || registerConfirming}
                  className="w-full py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
                >
                  {registerPending ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Confirm in Wallet...
                    </>
                  ) : registerConfirming ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </button>
              </>
            )}

            <p className="text-xs text-neutral-500 text-center">
              Registration is on Sepolia testnet. Get test ETH from{" "}
              <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                Sepolia Faucet
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClubPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<EnsSubdomain[] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    // Normalize the query
    let domain = searchQuery.trim().toLowerCase();
    if (!domain.endsWith(".eth")) {
      domain = `${domain}.eth`;
    }

    setIsSearching(true);
    setSearchError(null);
    setPreviewResults(null);

    try {
      const result = await resolveEnsSubdomains(domain);

      if (result.subdomains.length === 0) {
        // No subdomains found, but domain might exist
        // Navigate anyway to show the domain page
        router.push(`/club/${encodeURIComponent(domain)}`);
      } else {
        // Show preview or navigate
        setPreviewResults(result.subdomains);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Failed to resolve ENS domain"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewClub = () => {
    let domain = searchQuery.trim().toLowerCase();
    if (!domain.endsWith(".eth")) {
      domain = `${domain}.eth`;
    }
    router.push(`/club/${encodeURIComponent(domain)}`);
  };

  return (
    <div className="min-h-screen w-full bg-black/[0.96] antialiased relative overflow-hidden">
      {/* Spotlight effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="purple"
      />

      {/* Floating dock navigation */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <FloatingDock items={dockItems} />
      </div>

      {/* Wallet connect button */}
      <div className="fixed top-4 right-4 z-50">
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <button
                onClick={connected ? openAccountModal : openConnectModal}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  connected
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                    : "bg-violet-600 hover:bg-violet-500 text-white"
                }`}
              >
                <IconWallet className="w-4 h-4" />
                {connected
                  ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                  : "Connect Wallet"}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-4">
        {/* Sparkles background */}
        <div className="absolute inset-0 w-full h-full">
          <SparklesCore
            id="club-sparkles"
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={50}
            className="w-full h-full"
            particleColor="#8B5CF6"
          />
        </div>

        {/* Hero content */}
        <div className="relative z-20 text-center max-w-4xl mx-auto">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm">
              <IconUsers className="w-4 h-4" />
              ENS-Powered Organization
            </span>
          </div>

          <TextGenerateEffect
            words="ENS Club Hub"
            className="text-5xl md:text-7xl font-bold text-white mb-4"
          />

          <p className="text-lg md:text-xl text-neutral-400 mb-8 max-w-2xl mx-auto">
            Discover and manage your ENS domain as a club. Add members as subdomains,
            import wallets, and calculate taxes for your entire organization.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors flex items-center gap-2"
            >
              <IconPlus className="w-5 h-5" />
              Create New Club
            </button>
            <span className="text-neutral-500">or</span>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="relative max-w-xl mx-auto mb-8">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative flex items-center bg-neutral-900 rounded-xl border border-neutral-800">
                <IconSearch className="w-5 h-5 text-neutral-500 ml-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Explore existing club (e.g., vitalik.eth)"
                  className="flex-1 px-4 py-4 bg-transparent text-white placeholder:text-neutral-500 focus:outline-none text-lg"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="mr-2 px-6 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700/50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <IconLoader2 className="w-4 h-4 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      Explore
                      <IconArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Search error */}
          {searchError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm max-w-xl mx-auto">
              {searchError}
            </div>
          )}

          {/* Preview results */}
          {previewResults && (
            <div className="mb-8 p-6 rounded-2xl bg-neutral-900/80 border border-purple-800/30 max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <IconUsers className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-semibold">
                    {previewResults.length} member{previewResults.length !== 1 ? "s" : ""} found
                  </span>
                </div>
                <button
                  onClick={handleViewClub}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  View Club
                  <IconArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {previewResults.slice(0, 4).map((member) => (
                  <div
                    key={member.name}
                    className="px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700 text-sm"
                  >
                    <span className="text-neutral-300">{member.label}</span>
                    <span className="text-neutral-600">.{searchQuery.replace(".eth", "")}.eth</span>
                  </div>
                ))}
                {previewResults.length > 4 && (
                  <div className="px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700 text-sm text-neutral-500">
                    +{previewResults.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-neutral-500">
            Try: <button onClick={() => setSearchQuery("vitalik.eth")} className="text-purple-400 hover:text-purple-300">vitalik.eth</button>
            {" "}or{" "}
            <button onClick={() => setSearchQuery("ens.eth")} className="text-purple-400 hover:text-purple-300">ens.eth</button>
          </p>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-32">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Perfect for
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((useCase, idx) => (
            <HoverCard3D key={idx}>
              <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 h-full">
                <div className="w-14 h-14 rounded-xl bg-neutral-800/50 flex items-center justify-center mb-4">
                  {useCase.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {useCase.title}
                </h3>
                <p className="text-neutral-400 text-sm">
                  {useCase.description}
                </p>
              </div>
            </HoverCard3D>
          ))}
        </div>

        {/* CTA to main app */}
        <div className="mt-16 text-center">
          <p className="text-neutral-500 mb-4">
            Already have wallets set up?
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
          >
            <IconApps className="w-5 h-5" />
            Go to Tax App
          </Link>
        </div>
      </div>

      {/* Create Club Modal */}
      <CreateClubModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(domain) => {
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
