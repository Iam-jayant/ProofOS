interface CreateDdocInput {
  apiKey: string;
  title: string;
  content: string;
  signal?: AbortSignal;
}

interface PollDdocLinkInput {
  apiKey: string;
  ddocId: string;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface DdocStatus {
  ddocId: string;
  link: string | null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const maybeMessage = (payload as Record<string, unknown>).message;
    const maybeError = (payload as Record<string, unknown>).error;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) return maybeMessage;
    if (typeof maybeError === "string" && maybeError.length > 0) return maybeError;
  }
  return fallback;
}

function extractDdocId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.ddocId === "string" && record.ddocId.length > 0) return record.ddocId;
  if (typeof record.id === "string" && record.id.length > 0) return record.id;

  const data = record.data;
  if (typeof data === "object" && data !== null) {
    const nested = data as Record<string, unknown>;
    if (typeof nested.ddocId === "string" && nested.ddocId.length > 0) return nested.ddocId;
    if (typeof nested.id === "string" && nested.id.length > 0) return nested.id;
  }

  return null;
}

function extractDdocLink(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.link === "string" && record.link.length > 0) return record.link;

  const data = record.data;
  if (typeof data === "object" && data !== null) {
    const nested = data as Record<string, unknown>;
    if (typeof nested.link === "string" && nested.link.length > 0) return nested.link;
  }

  return null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Request aborted"));
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      reject(new Error("Request aborted"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function createDdocDocument(input: CreateDdocInput): Promise<{ ddocId: string }> {
  const query = new URLSearchParams({ apiKey: input.apiKey });
  const response = await fetch(`/api/ddocs?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, content: input.content }),
    signal: input.signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Failed to create report (HTTP ${response.status})`));
  }

  const ddocId = extractDdocId(payload);
  if (!ddocId) {
    throw new Error("Document created but no ddocId was returned by /api/ddocs");
  }

  return { ddocId };
}

export async function getDdocStatus(apiKey: string, ddocId: string, signal?: AbortSignal): Promise<DdocStatus> {
  const query = new URLSearchParams({ apiKey });
  const response = await fetch(`/api/ddocs/${encodeURIComponent(ddocId)}?${query.toString()}`, { signal });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Failed to fetch report status (HTTP ${response.status})`));
  }

  return {
    ddocId,
    link: extractDdocLink(payload),
  };
}

export async function pollForDdocLink(input: PollDdocLinkInput): Promise<string> {
  const intervalMs = input.intervalMs ?? 2000;
  const timeoutMs = input.timeoutMs ?? 30000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getDdocStatus(input.apiKey, input.ddocId, input.signal);
    if (status.link) {
      return status.link;
    }
    await sleep(intervalMs, input.signal);
  }

  throw new Error("Timed out waiting for Fileverse shareable link. Please try again.");
}