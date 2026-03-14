"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FloatingDock } from "@/components/ui/floating-dock";
import { HoverCard3D } from "@/components/ui/card-3d";
import { resolveEnsSubdomains, type EnsSubdomain } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  ENS_CONTRACTS,
  ensRegistryConfig,
  nameWrapperConfig,
  resolverConfig,
  namehash,
  namehashToTokenId,
} from "@/lib/ens-contracts";
import {
  IconHome,
  IconApps,
  IconShieldCheck,
  IconUsers,
  IconArrowLeft,
  IconLoader2,
  IconRefresh,
  IconUserPlus,
  IconDownload,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconWallet,
  IconCrown,
  IconX,
  IconAlertCircle,
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

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface MemberCardProps {
  member: EnsSubdomain;
  isOwner?: boolean;
  onCopy: (text: string) => void;
  copied: string | null;
}

function MemberCard({ member, isOwner, onCopy, copied }: MemberCardProps) {
  const hasAddress = member.address !== null;

  return (
    <HoverCard3D>
      <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-purple-800/50 transition-colors h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
            hasAddress
              ? "bg-gradient-to-br from-purple-500 to-pink-500"
              : "bg-gradient-to-br from-neutral-600 to-neutral-700"
          }`}>
            {member.label.charAt(0).toUpperCase()}
          </div>
          {isOwner && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
              <IconCrown className="w-3 h-3" />
              Owner
            </span>
          )}
          {!hasAddress && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-700/50 text-neutral-400 text-xs">
              No addr set
            </span>
          )}
        </div>

        <h3 className="font-semibold text-white mb-1">
          {member.label}
        </h3>
        <p className="text-sm text-neutral-500 mb-3 truncate">
          {member.name}
        </p>

        {hasAddress ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-neutral-400 font-mono truncate">
              {shortenAddress(member.address!)}
            </code>
            <button
              onClick={() => onCopy(member.address!)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              {copied === member.address ? (
                <IconCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <IconCopy className="w-4 h-4 text-neutral-500" />
              )}
            </button>
            <a
              href={`https://sepolia.etherscan.io/address/${member.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <IconExternalLink className="w-4 h-4 text-neutral-500" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic">
            Address record not configured
          </p>
        )}
      </div>
    </HoverCard3D>
  );
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentDomain: string;
  parentNode: `0x${string}`;
  onSuccess: () => void;
}

type AddMemberStep = "form" | "creating" | "settingAddr" | "success";

function AddMemberModal({ isOpen, onClose, parentDomain, parentNode, onSuccess }: AddMemberModalProps) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [step, setStep] = useState<AddMemberStep>("form");
  const { address: connectedAddress } = useAccount();

  // Step 1: Create subdomain via NameWrapper
  const {
    writeContract: createSubdomain,
    data: createTxHash,
    isPending: isCreatePending,
    error: createError,
    reset: resetCreate,
  } = useWriteContract();

  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  // Step 2: Set address record on resolver
  const {
    writeContract: setAddrRecord,
    data: setAddrTxHash,
    isPending: isSetAddrPending,
    error: setAddrError,
    reset: resetSetAddr,
  } = useWriteContract();

  const { isLoading: isSetAddrConfirming, isSuccess: isSetAddrSuccess } = useWaitForTransactionReceipt({
    hash: setAddrTxHash,
  });

  // When subdomain creation succeeds, set the address record
  useEffect(() => {
    if (isCreateSuccess && step === "creating") {
      setTimeout(() => setStep("settingAddr"), 0);
      // Compute the subdomain node hash
      const subdomainName = `${label.toLowerCase().trim()}.${parentDomain}`;
      const subdomainNode = namehash(subdomainName) as `0x${string}`;

      // Set the address record on the resolver
      setAddrRecord({
        ...resolverConfig,
        functionName: "setAddr",
        args: [subdomainNode, address as `0x${string}`],
      });
    }
  }, [isCreateSuccess, step, label, parentDomain, address, setAddrRecord]);

  // When addr record is set, show success
  useEffect(() => {
    if (isSetAddrSuccess && step === "settingAddr") {
      setTimeout(() => setStep("success"), 0);
      onSuccess();
      setTimeout(() => {
        onClose();
        setLabel("");
        setAddress("");
        setStep("form");
        resetCreate();
        resetSetAddr();
      }, 2000);
    }
  }, [isSetAddrSuccess, step, onSuccess, onClose, resetCreate, resetSetAddr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim() || !address.trim() || !connectedAddress) return;

    setStep("creating");

    // Use max uint64 for expiry so subdomains do not expire automatically.
    const maxExpiry = BigInt("18446744073709551615");

    // Create subdomain with connected wallet as owner (so we can set addr record)
    createSubdomain({
      ...nameWrapperConfig,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        label.toLowerCase().trim(),
        connectedAddress, // Owner = connected wallet (so we can set addr)
        ENS_CONTRACTS.resolver,
        BigInt(0), // TTL
        0, // Fuses (no restrictions)
        maxExpiry,
      ],
    });
  };

  const handleClose = () => {
    if (step === "form" || step === "success") {
      onClose();
      setLabel("");
      setAddress("");
      setStep("form");
      resetCreate();
      resetSetAddr();
    }
  };

  const error = createError || setAddrError;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={handleClose} />
      <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Add Member</h3>
          <button onClick={handleClose} className="p-1 hover:bg-neutral-800 rounded-lg">
            <IconX className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {step === "success" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <IconCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Member Added!</h4>
            <p className="text-neutral-400 text-sm">
              {label}.{parentDomain} now resolves to {shortenAddress(address)}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Progress indicator for multi-step */}
            {(step === "creating" || step === "settingAddr") && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-800/50 mb-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === "creating" ? "bg-purple-600 text-white" : "bg-emerald-500 text-white"
                }`}>
                  {step === "creating" ? "1" : <IconCheck className="w-3 h-3" />}
                </div>
                <span className="text-sm text-neutral-400">Create subdomain</span>
                <div className="flex-1 h-0.5 mx-2 bg-neutral-700">
                  <div className={`h-full transition-all ${step === "settingAddr" ? "w-full bg-emerald-500" : "w-0"}`} />
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === "settingAddr" ? "bg-purple-600 text-white" : "bg-neutral-700 text-neutral-500"
                }`}>
                  2
                </div>
                <span className="text-sm text-neutral-400">Set address</span>
              </div>
            )}

            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                Subdomain Label
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                  placeholder="alice"
                  disabled={step !== "form"}
                  className="flex-1 px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-600 disabled:opacity-50"
                />
                <span className="text-neutral-500">.{parentDomain}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                disabled={step !== "form"}
                className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white font-mono text-sm placeholder:text-neutral-500 focus:outline-none focus:border-purple-600 disabled:opacity-50"
              />
              {connectedAddress && step === "form" && (
                <button
                  type="button"
                  onClick={() => setAddress(connectedAddress)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                >
                  Use connected wallet
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm flex items-start gap-2">
                <IconAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-all">{error.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={step !== "form" || !label.trim() || !address.trim()}
              className="w-full py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
            >
              {step === "creating" && isCreatePending ? (
                <>
                  <IconLoader2 className="w-5 h-5 animate-spin" />
                  Confirm in Wallet (1/2)
                </>
              ) : step === "creating" && isCreateConfirming ? (
                <>
                  <IconLoader2 className="w-5 h-5 animate-spin" />
                  Creating Subdomain...
                </>
              ) : step === "settingAddr" && isSetAddrPending ? (
                <>
                  <IconLoader2 className="w-5 h-5 animate-spin" />
                  Confirm in Wallet (2/2)
                </>
              ) : step === "settingAddr" && isSetAddrConfirming ? (
                <>
                  <IconLoader2 className="w-5 h-5 animate-spin" />
                  Setting Address...
                </>
              ) : (
                <>
                  <IconUserPlus className="w-5 h-5" />
                  Create Member
                </>
              )}
            </button>

            <p className="text-xs text-neutral-500 text-center">
              This requires 2 transactions: create subdomain + set address record
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ClubDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const decodedDomain = decodeURIComponent(domain);
  const { address } = useAccount();
  const { addWallet, session } = useSession();

  const [members, setMembers] = useState<EnsSubdomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importCount, setImportCount] = useState<number | null>(null);

  const parentNode = namehash(decodedDomain) as `0x${string}`;
  const tokenId = namehashToTokenId(parentNode);

  // Check if connected wallet owns the domain via NameWrapper (for wrapped names)
  const { data: nameWrapperOwner } = useReadContract({
    ...nameWrapperConfig,
    functionName: "ownerOf",
    args: [tokenId],
  });

  // Also check ENS Registry owner (for unwrapped names)
  const { data: registryOwner } = useReadContract({
    ...ensRegistryConfig,
    functionName: "owner",
    args: [parentNode],
  });

  // User is owner if they own via NameWrapper OR directly via Registry
  const isOwner = address && (
    (nameWrapperOwner && address.toLowerCase() === (nameWrapperOwner as string).toLowerCase()) ||
    (registryOwner && address.toLowerCase() === (registryOwner as string).toLowerCase())
  );

  // For display, prefer NameWrapper owner, fallback to Registry owner
  const domainOwner = nameWrapperOwner || registryOwner;

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await resolveEnsSubdomains(decodedDomain);
      setMembers(result.subdomains);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch members");
    } finally {
      setIsLoading(false);
    }
  }, [decodedDomain]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // Filter members with addresses for import and stats
  const membersWithAddresses = members.filter((m) => m.address !== null);

  const handleImportAll = () => {
    let imported = 0;

    membersWithAddresses.forEach((member) => {
      // Check if wallet already exists
      const exists = session.wallets.some(
        (w) => w.address.toLowerCase() === member.address!.toLowerCase()
      );

      if (!exists) {
        addWallet(member.address!, member.name);
        imported++;
      }
    });

    setImportCount(imported);
    setTimeout(() => setImportCount(null), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-black/[0.96] antialiased relative">
      {/* Floating dock navigation */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <FloatingDock items={dockItems} />
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-16 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/club"
              className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <IconArrowLeft className="w-5 h-5 text-neutral-400" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                {decodedDomain}
                {isOwner && (
                  <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-normal flex items-center gap-1">
                    <IconCrown className="w-4 h-4" />
                    You own this
                  </span>
                )}
              </h1>
              <p className="text-neutral-500 mt-1">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
                const connected = mounted && account && chain;
                return (
                  <button
                    onClick={connected ? openAccountModal : openConnectModal}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      connected
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                        : "bg-purple-600 hover:bg-purple-500 text-white"
                    }`}
                  >
                    <IconWallet className="w-4 h-4" />
                    {connected
                      ? shortenAddress(account.address)
                      : "Connect Wallet"}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <button
            onClick={fetchMembers}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <IconRefresh className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          {isOwner && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              <IconUserPlus className="w-4 h-4" />
              Add Member
            </button>
          )}

          {membersWithAddresses.length > 0 && (
            <button
              onClick={handleImportAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <IconDownload className="w-4 h-4" />
              Import to ProofOS
            </button>
          )}

          {importCount !== null && (
            <span className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">
              Imported {importCount} wallet{importCount !== 1 ? "s" : ""}!
            </span>
          )}

          <Link
            href="/app"
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
          >
            <IconApps className="w-4 h-4" />
            Go to Tax App
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Subdomains</p>
            <p className="text-2xl font-bold text-white">{members.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">With Addresses</p>
            <p className="text-2xl font-bold text-purple-400">
              {membersWithAddresses.length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">In Session</p>
            <p className="text-2xl font-bold text-emerald-400">
              {membersWithAddresses.filter((m) =>
                session.wallets.some(
                  (w) => w.address.toLowerCase() === m.address!.toLowerCase()
                )
              ).length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Network</p>
            <p className="text-lg font-medium text-neutral-300">Sepolia</p>
          </div>
        </div>

        {/* Members grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <IconLoader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-950/30 border border-red-800/50 text-center">
            <IconAlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchMembers}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center">
            <IconUsers className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-300 mb-2">
              No members yet
            </h3>
            <p className="text-neutral-500 mb-4">
              This club doesn&apos;t have any subdomains with resolved addresses.
            </p>
            {isOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Add First Member
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map((member) => (
              <MemberCard
                key={member.name}
                member={member}
                isOwner={domainOwner && member.address !== null && member.address.toLowerCase() === (domainOwner as string).toLowerCase()}
                onCopy={copyToClipboard}
                copied={copied}
              />
            ))}
          </div>
        )}

        {/* Info section */}
        <div className="mt-12 p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
          <h3 className="text-lg font-semibold text-white mb-4">About ENS Clubs</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-neutral-400">
            <div>
              <h4 className="font-medium text-neutral-200 mb-2">What are ENS Clubs?</h4>
              <p>
                ENS Clubs use ENS subdomains to organize wallets under a common root domain.
                For example, <code className="text-purple-400">alice.family.eth</code> and{" "}
                <code className="text-purple-400">bob.family.eth</code> are members of the{" "}
                <code className="text-purple-400">family.eth</code> club.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-neutral-200 mb-2">Tax Analysis</h4>
              <p>
                Import all members to ProofOS with one click, then sync transactions
                and calculate taxes for your entire organization. Perfect for DAOs,
                family offices, and investment clubs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        parentDomain={decodedDomain}
        parentNode={parentNode}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
