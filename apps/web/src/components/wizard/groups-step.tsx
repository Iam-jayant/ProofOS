"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import {
  IconPlus,
  IconTrash,
  IconFolder,
  IconWallet,
  IconCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface GroupsStepProps {
  onNext: () => void;
  onBack: () => void;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function GroupsStep({ onNext, onBack }: GroupsStepProps) {
  const {
    session,
    addWalletGroup,
    removeWalletGroup,
    updateWallet,
  } = useSession();
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState("");

  const handleAddGroup = () => {
    setError("");

    if (!newGroupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    if (session.walletGroups.some((g) => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
      setError("A group with this name already exists");
      return;
    }

    addWalletGroup(newGroupName.trim());
    setNewGroupName("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddGroup();
    }
  };

  const handleAssignGroup = (walletId: string, groupId: string | undefined) => {
    updateWallet(walletId, { groupId });
  };

  const ungroupedWallets = session.wallets.filter((w) => !w.groupId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-200 mb-2">
          Organize Wallets (Optional)
        </h2>
        <p className="text-neutral-500 text-sm">
          Group wallets by family member, business unit, or purpose. This helps with attribution and reporting.
        </p>
      </div>

      {/* Add group form */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Group name (e.g., Personal, Business, Family)"
            className="flex-1 px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 text-sm"
          />
          <button
            onClick={handleAddGroup}
            className="px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <IconPlus className="w-4 h-4" />
            Add Group
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {/* Groups and wallet assignment */}
      <div className="space-y-4">
        {session.walletGroups.map((group) => {
          const groupWallets = session.wallets.filter((w) => w.groupId === group.id);
          return (
            <div
              key={group.id}
              className="rounded-xl border border-neutral-700 bg-neutral-800/30 overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 border-b border-neutral-700/50">
                <div className="flex items-center gap-2">
                  <IconFolder className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-neutral-200">{group.name}</span>
                  <span className="text-xs text-neutral-500">
                    ({groupWallets.length} wallet{groupWallets.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <button
                  onClick={() => removeWalletGroup(group.id)}
                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                >
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {groupWallets.length === 0 ? (
                  <p className="text-neutral-500 text-xs p-2 text-center">
                    Drag wallets here or select from below
                  </p>
                ) : (
                  groupWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/50 group"
                    >
                      <IconWallet className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-mono text-xs text-neutral-300">
                        {shortenAddress(wallet.address)}
                      </span>
                      {wallet.label && (
                        <span className="text-xs text-neutral-500">
                          ({wallet.label})
                        </span>
                      )}
                      <button
                        onClick={() => handleAssignGroup(wallet.id, undefined)}
                        className="ml-auto text-xs text-neutral-500 hover:text-neutral-300 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Ungrouped wallets */}
        {ungroupedWallets.length > 0 && (
          <div className="rounded-xl border border-dashed border-neutral-700 p-4">
            <p className="text-sm text-neutral-400 mb-3">
              Ungrouped Wallets ({ungroupedWallets.length})
            </p>
            <div className="space-y-2">
              {ungroupedWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-neutral-800/30"
                >
                  <IconWallet className="w-4 h-4 text-neutral-500" />
                  <div className="flex-1">
                    <span className="font-mono text-sm text-neutral-300">
                      {shortenAddress(wallet.address)}
                    </span>
                    {wallet.label && (
                      <span className="text-xs text-neutral-500 ml-2">
                        ({wallet.label})
                      </span>
                    )}
                  </div>
                  {session.walletGroups.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignGroup(wallet.id, e.target.value);
                        }
                      }}
                      className="text-xs bg-neutral-700 border-none rounded px-2 py-1 text-neutral-300 focus:outline-none"
                    >
                      <option value="">Assign to group...</option>
                      {session.walletGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {session.walletGroups.length === 0 && ungroupedWallets.length === 0 && (
          <div className="p-8 rounded-xl border border-dashed border-neutral-700 text-center">
            <IconFolder className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">
              No groups created. You can skip this step if you don&apos;t need to organize wallets.
            </p>
          </div>
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
          onClick={onNext}
          className="px-6 py-2 rounded-full font-medium bg-white text-black hover:bg-neutral-200 transition-colors flex items-center gap-2"
        >
          <IconCheck className="w-4 h-4" />
          Complete Setup
        </button>
      </div>
    </div>
  );
}
