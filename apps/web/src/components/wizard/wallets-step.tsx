"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { resolveEnsSubdomains, type EnsSubdomain } from "@/lib/api";
import {
  IconPlus,
  IconTrash,
  IconWallet,
  IconWorld,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface WalletsStepProps {
  onNext: () => void;
  onBack: () => void;
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type InputMode = "address" | "ens";

export function WalletsStep({ onNext, onBack }: WalletsStepProps) {
  const { session, addWallet, removeWallet, updateWallet } = useSession();
  const [inputMode, setInputMode] = useState<InputMode>("address");

  // Address input state
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");

  // ENS input state
  const [ensRoot, setEnsRoot] = useState("");
  const [ensLoading, setEnsLoading] = useState(false);
  const [ensResults, setEnsResults] = useState<EnsSubdomain[] | null>(null);
  const [ensError, setEnsError] = useState("");
  const [selectedEns, setSelectedEns] = useState<Set<string>>(new Set());

  const handleAddWallet = () => {
    setError("");

    if (!newAddress.trim()) {
      setError("Please enter an address");
      return;
    }

    const address = newAddress.trim().toLowerCase();

    if (!isValidAddress(address)) {
      setError("Invalid Ethereum address format");
      return;
    }

    if (session.wallets.some((w) => w.address.toLowerCase() === address)) {
      setError("This address is already added");
      return;
    }

    addWallet(address, newLabel.trim() || undefined);
    setNewAddress("");
    setNewLabel("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddWallet();
    }
  };

  const handleResolveEns = async () => {
    setEnsError("");
    setEnsResults(null);
    setSelectedEns(new Set());

    if (!ensRoot.trim()) {
      setEnsError("Please enter an ENS root name");
      return;
    }

    // Normalize the name
    let rootName = ensRoot.trim().toLowerCase();
    if (!rootName.includes(".")) {
      rootName = `${rootName}.eth`;
    }

    setEnsLoading(true);

    try {
      const response = await resolveEnsSubdomains(rootName);
      // Filter to only include subdomains with resolved addresses
      const withAddresses = response.subdomains.filter((s) => s.address !== null);
      if (withAddresses.length === 0) {
        setEnsError("No subdomains with resolved addresses found");
      } else {
        setEnsResults(withAddresses);
        // Select all by default
        setSelectedEns(new Set(withAddresses.map((s) => s.address!)));
      }
    } catch (err) {
      setEnsError(err instanceof Error ? err.message : "Failed to resolve ENS");
    } finally {
      setEnsLoading(false);
    }
  };

  const handleEnsKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleResolveEns();
    }
  };

  const toggleEnsSelection = (address: string) => {
    const next = new Set(selectedEns);
    if (next.has(address)) {
      next.delete(address);
    } else {
      next.add(address);
    }
    setSelectedEns(next);
  };

  const handleAddSelectedEns = () => {
    if (!ensResults) return;

    for (const subdomain of ensResults) {
      // Only include subdomains with addresses (already filtered)
      if (!subdomain.address) continue;
      if (selectedEns.has(subdomain.address)) {
        // Skip if already exists
        if (session.wallets.some((w) => w.address.toLowerCase() === subdomain.address!.toLowerCase())) {
          continue;
        }
        addWallet(subdomain.address.toLowerCase(), subdomain.name);
      }
    }

    // Reset ENS state
    setEnsRoot("");
    setEnsResults(null);
    setSelectedEns(new Set());
  };

  const handleContinue = () => {
    if (session.wallets.length > 0) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-200 mb-2">
          Add Your Wallets
        </h2>
        <p className="text-neutral-500 text-sm">
          Enter wallet addresses directly or resolve from an ENS root name.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-neutral-800/50 rounded-lg">
        <button
          onClick={() => setInputMode("address")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
            inputMode === "address"
              ? "bg-neutral-700 text-white"
              : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          <IconWallet className="w-4 h-4" />
          Address
        </button>
        <button
          onClick={() => setInputMode("ens")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
            inputMode === "ens"
              ? "bg-neutral-700 text-white"
              : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          <IconWorld className="w-4 h-4" />
          ENS Root
        </button>
      </div>

      {/* Address input */}
      {inputMode === "address" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="0x..."
              className="flex-1 px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono text-sm"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Label (optional)"
              className="w-40 px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 text-sm"
            />
            <button
              onClick={handleAddWallet}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <IconPlus className="w-4 h-4" />
              Add
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}

      {/* ENS input */}
      {inputMode === "ens" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={ensRoot}
              onChange={(e) => setEnsRoot(e.target.value)}
              onKeyDown={handleEnsKeyPress}
              placeholder="family.eth"
              className="flex-1 px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 text-sm"
            />
            <button
              onClick={handleResolveEns}
              disabled={ensLoading}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {ensLoading ? (
                <>
                  <IconLoader2 className="w-4 h-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <IconWorld className="w-4 h-4" />
                  Resolve
                </>
              )}
            </button>
          </div>
          {ensError && <p className="text-red-400 text-sm">{ensError}</p>}

          {/* ENS results */}
          {ensResults && ensResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-400">
                Found {ensResults.length} subdomain{ensResults.length !== 1 ? "s" : ""} with addresses:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {ensResults.filter((s) => s.address !== null).map((subdomain) => (
                  <label
                    key={subdomain.address!}
                    className="flex items-center gap-3 p-2 bg-neutral-800/30 border border-neutral-700/50 rounded-lg cursor-pointer hover:bg-neutral-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEns.has(subdomain.address!)}
                      onChange={() => toggleEnsSelection(subdomain.address!)}
                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200">{subdomain.name}</p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {shortenAddress(subdomain.address!)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={handleAddSelectedEns}
                disabled={selectedEns.size === 0}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <IconPlus className="w-4 h-4" />
                Add {selectedEns.size} Selected Wallet{selectedEns.size !== 1 ? "s" : ""}
              </button>
            </div>
          )}

          <p className="text-xs text-neutral-600">
            Note: ENS resolution uses The Graph on mainnet. Only subdomains with resolved addresses are shown.
          </p>
        </div>
      )}

      {/* Wallet list */}
      <div className="space-y-2">
        {session.wallets.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-neutral-700 text-center">
            <IconWallet className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">
              No wallets added yet. Add at least one wallet to continue.
            </p>
          </div>
        ) : (
          session.wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center gap-3 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg group"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-700/50 flex items-center justify-center">
                <IconWallet className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-neutral-200">
                  {shortenAddress(wallet.address)}
                </p>
                {wallet.label ? (
                  <p className="text-xs text-neutral-500">{wallet.label}</p>
                ) : (
                  <input
                    type="text"
                    placeholder="Add label..."
                    className="text-xs text-neutral-500 bg-transparent border-none focus:outline-none w-full"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        updateWallet(wallet.id, { label: e.target.value.trim() });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = e.target as HTMLInputElement;
                        if (target.value.trim()) {
                          updateWallet(wallet.id, { label: target.value.trim() });
                        }
                        target.blur();
                      }
                    }}
                  />
                )}
              </div>
              <button
                onClick={() => removeWallet(wallet.id)}
                className="p-1.5 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 rounded-full font-medium text-neutral-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={session.wallets.length === 0}
          className={cn(
            "px-6 py-2 rounded-full font-medium transition-colors",
            session.wallets.length > 0
              ? "bg-white text-black hover:bg-neutral-200"
              : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
