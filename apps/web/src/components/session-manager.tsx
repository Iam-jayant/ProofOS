"use client";

import { useRef, useState } from "react";
import { useSession } from "@/lib/session";
import {
  IconDownload,
  IconUpload,
  IconTrash,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

export function SessionManager() {
  const { exportSession, importSession, resetSession, session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = () => {
    const json = exportSession();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proofos-session-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importSession(content);
      setImportStatus(success ? "success" : "error");
      setTimeout(() => setImportStatus("idle"), 2000);
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleReset = () => {
    resetSession();
    setShowResetConfirm(false);
  };

  const hasData =
    session.wallets.length > 0 ||
    session.ledger.length > 0 ||
    session.userType !== undefined;

  return (
    <div className="flex items-center gap-2">
      {/* Export */}
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors"
        title="Export session"
      >
        <IconDownload className="w-3.5 h-3.5" />
        Export
      </button>

      {/* Import */}
      <button
        onClick={handleImportClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
          importStatus === "success"
            ? "text-green-400 bg-green-950/50 border-green-800"
            : importStatus === "error"
            ? "text-red-400 bg-red-950/50 border-red-800"
            : "text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 border-neutral-700"
        }`}
        title="Import session"
      >
        {importStatus === "success" ? (
          <IconCheck className="w-3.5 h-3.5" />
        ) : importStatus === "error" ? (
          <IconX className="w-3.5 h-3.5" />
        ) : (
          <IconUpload className="w-3.5 h-3.5" />
        )}
        {importStatus === "success"
          ? "Imported"
          : importStatus === "error"
          ? "Invalid"
          : "Import"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Reset */}
      {showResetConfirm ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400">Reset?</span>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-950 border border-red-800 rounded transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setShowResetConfirm(false)}
            className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 rounded transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowResetConfirm(true)}
          disabled={!hasData}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
            hasData
              ? "text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 border-red-900/50 hover:border-red-800"
              : "text-neutral-600 bg-neutral-900/50 border-neutral-800 cursor-not-allowed"
          }`}
          title="Reset session"
        >
          <IconTrash className="w-3.5 h-3.5" />
          Reset
        </button>
      )}
    </div>
  );
}
