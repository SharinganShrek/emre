import { getConfiguredAiApiKey } from "@/lib/ai/key";

const ORIGIN = "https://emre-xi.vercel.app";

type AnyRoute = (
  request: Request,
  context: { params: Promise<{ op: string }> },
) => Promise<Response> | Response;

export function queryValue(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export async function invokeAiRoute(
  handler: AnyRoute,
  path: string,
  method: "GET" | "POST" | "PATCH",
  options?: {
    query?: Record<string, unknown>;
    body?: unknown;
    params?: Record<string, string>;
  },
) {
  const key = getConfiguredAiApiKey();
  const url = new URL(path, ORIGIN);
  if (key) url.searchParams.set("api_key", key);
  for (const [name, value] of Object.entries(options?.query || {})) {
    const text = queryValue(value);
    if (text != null) url.searchParams.set(name, text);
  }
  const request = new Request(url, {
    method,
    headers:
      options?.body !== undefined
        ? { "content-type": "application/json" }
        : undefined,
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const response = await handler(request, {
    params: Promise.resolve({ op: options?.params?.op || "" }),
  });
  const text = await response.text();
  return {
    content: [{ type: "text" as const, text }],
    isError: response.status >= 400,
  };
}
