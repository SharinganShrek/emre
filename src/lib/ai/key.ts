/** Shared AI API-key parsing. Keep free of `server-only` so it can be unit-tested. */

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/g;

export function normalizeAiSecret(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(ZERO_WIDTH, "")
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, "");
}

export function getConfiguredAiApiKey(): string {
  return normalizeAiSecret(process.env.AI_API_KEY);
}

export type AiKeySource =
  | "x-api-key"
  | "x-ai-api-key"
  | "api-key"
  | "bearer"
  | "basic"
  | "raw-authorization"
  | "none";

export interface ExtractedAiKey {
  key: string;
  source: AiKeySource;
}

function decodeBasic(value: string): string {
  const encoded = value.slice(6).trim();
  try {
    const decoded = atob(encoded);
    const user = decoded.split(":")[0] ?? "";
    return normalizeAiSecret(user || decoded);
  } catch {
    return "";
  }
}

const NAMED_KEY_HEADERS: Array<
  [string, Exclude<AiKeySource, "bearer" | "basic" | "raw-authorization" | "none">]
> = [
  ["x-api-key", "x-api-key"],
  ["x-ai-api-key", "x-ai-api-key"],
  ["api-key", "api-key"],
];

/** Read the GPT/Action secret from common header shapes ChatGPT actually sends. */
export function extractAiApiKeyDetailed(request: Request): ExtractedAiKey {
  // Custom GPT Bearer auth often sends a broken Authorization header and never
  // reaches the server. Prefer the named API-key headers ChatGPT Custom auth uses.
  for (const [header, source] of NAMED_KEY_HEADERS) {
    const key = normalizeAiSecret(request.headers.get(header));
    if (key) return { key, source };
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const trimmed = normalizeAiSecret(authorization);
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("basic ")) {
      const key = decodeBasic(trimmed);
      if (key) return { key, source: "basic" };
    }
    let value = trimmed;
    let bearer = false;
    while (value.toLowerCase().startsWith("bearer ")) {
      bearer = true;
      value = normalizeAiSecret(value.slice(7));
    }
    if (value) {
      return { key: value, source: bearer ? "bearer" : "raw-authorization" };
    }
  }

  return { key: "", source: "none" };
}

export function extractAiApiKey(request: Request): string | null {
  const { key } = extractAiApiKeyDetailed(request);
  return key || null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function aiKeysMatch(provided: string, configured: string): boolean {
  return (
    Boolean(provided) &&
    Boolean(configured) &&
    timingSafeEqual(provided, configured)
  );
}

export const AI_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-ai-api-key, x-api-key, api-key",
  "Access-Control-Max-Age": "86400",
};
