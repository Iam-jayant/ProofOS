"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconLoader2,
  IconShare,
} from "@tabler/icons-react";
import { createDdocDocument, pollForDdocLink } from "@/lib/ddocs";

interface ReportGeneratorProps {
  reportTitle: string;
  reportContent: string;
  fileName?: string;
  apiKey?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export function ReportGenerator({
  reportTitle,
  reportContent,
  fileName = "report.md",
  apiKey,
  pollIntervalMs = 2000,
  pollTimeoutMs = 30000,
}: ReportGeneratorProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  // Always keep a fresh blob URL for direct download
  useEffect(() => {
    if (!reportContent) {
      setDownloadUrl(null);
      return;
    }
    const blob = new Blob([reportContent], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    setDownloadUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [reportContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const onShareViaFileverse = async () => {
    if (!reportContent.trim()) {
      setError("Report content is empty. Nothing to generate.");
      return;
    }

    const resolvedApiKey =
      apiKey ??
      (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILEVERSE_API_KEY : undefined) ??
      "";

    if (!resolvedApiKey) {
      setError("Missing Fileverse API key. Set NEXT_PUBLIC_FILEVERSE_API_KEY in .env.local.");
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsSharing(true);
    setError(null);
    setCopied(false);
    setShareableLink(null);

    try {
      const { ddocId } = await createDdocDocument({
        apiKey: resolvedApiKey,
        title: reportTitle,
        content: reportContent,
        signal: controller.signal,
      });

      const link = await pollForDdocLink({
        apiKey: resolvedApiKey,
        ddocId,
        intervalMs: pollIntervalMs,
        timeoutMs: pollTimeoutMs,
        signal: controller.signal,
      });

      setShareableLink(link);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to share report.");
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      setIsSharing(false);
    }
  };

  const onCopyLink = async () => {
    if (!shareableLink) return;
    await navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasContent = reportContent.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Action row — always visible once tax is calculated */}
      <div className="flex gap-2">
        {/* Yellow Download button — always available, no API needed */}
        <a
          href={downloadUrl ?? undefined}
          download={fileName}
          aria-disabled={!hasContent || !downloadUrl}
          onClick={(e) => { if (!hasContent || !downloadUrl) e.preventDefault(); }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2
            ${hasContent && downloadUrl
              ? "bg-yellow-400 hover:bg-yellow-300 text-neutral-900 cursor-pointer shadow-md shadow-yellow-500/20"
              : "bg-yellow-400/30 text-neutral-500 cursor-not-allowed"
            }`}
        >
          <IconDownload className="w-4 h-4" />
          Download Report
        </a>

        {/* Share via Fileverse */}
        <button
          onClick={onShareViaFileverse}
          disabled={isSharing || !hasContent}
          className="flex-1 py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-blue-700/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isSharing ? (
            <><IconLoader2 className="w-4 h-4 animate-spin" /> Sharing…</>
          ) : (
            <><IconShare className="w-4 h-4" /> Share via Fileverse</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2">
          <IconAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success — shareable link */}
      {shareableLink && (
        <div className="p-3 rounded-lg border border-emerald-800/40 bg-emerald-950/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
            <IconCheck className="w-4 h-4" />
            Report shared successfully
          </div>

          <div className="space-y-1">
            <p className="text-xs text-emerald-200/70 uppercase tracking-wide">Shareable Link</p>
            <div className="flex items-center gap-2 bg-neutral-900/60 border border-neutral-700 rounded-lg px-3 py-2">
              <a
                href={shareableLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-200 truncate flex-1 hover:text-white transition-colors"
              >
                {shareableLink}
              </a>
              <button
                onClick={onCopyLink}
                className="p-1 rounded hover:bg-neutral-700 transition-colors"
                title="Copy link"
              >
                {copied ? (
                  <IconCheck className="w-3 h-3 text-emerald-400" />
                ) : (
                  <IconCopy className="w-3 h-3 text-neutral-300" />
                )}
              </button>
              <a
                href={shareableLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-neutral-700 transition-colors"
                title="Open link"
              >
                <IconExternalLink className="w-3 h-3 text-neutral-300" />
              </a>
            </div>
          </div>
        </div>
      )}

      {!shareableLink && !error && hasContent && (
        <p className="text-xs text-neutral-500 text-center">
          <IconFileText className="w-3 h-3 inline mr-1" />
          Download saves a local .md file · Share publishes to Fileverse (IPFS)
        </p>
      )}
    </div>
  );
}
