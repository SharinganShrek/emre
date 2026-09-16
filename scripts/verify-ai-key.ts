import {
  aiKeysMatch,
  extractAiApiKeyDetailed,
  normalizeAiSecret,
} from "../src/lib/ai/key";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function req(headers: Record<string, string>) {
  return new Request("https://emre-xi.vercel.app/api/ai/health", { headers });
}

assert(normalizeAiSecret('  "abc" \n') === "abc", "trim quotes and whitespace");
assert(normalizeAiSecret("\uFEFFabc") === "abc", "strip BOM");

const bearer = extractAiApiKeyDetailed(
  req({ authorization: "Bearer secret-key" }),
);
assert(bearer.key === "secret-key" && bearer.source === "bearer", "bearer");

const double = extractAiApiKeyDetailed(
  req({ authorization: "Bearer Bearer secret-key" }),
);
assert(double.key === "secret-key", "double Bearer prefix");

const raw = extractAiApiKeyDetailed(req({ authorization: "secret-key" }));
assert(raw.key === "secret-key" && raw.source === "raw-authorization", "raw");

const basic = extractAiApiKeyDetailed(
  req({ authorization: `Basic ${btoa("secret-key:")}` }),
);
assert(basic.key === "secret-key" && basic.source === "basic", "basic");

const header = extractAiApiKeyDetailed(req({ "x-ai-api-key": " secret-key " }));
assert(header.key === "secret-key" && header.source === "x-ai-api-key", "fallback header");

const none = extractAiApiKeyDetailed(req({}));
assert(none.source === "none" && none.key === "", "missing");

assert(aiKeysMatch("abc", "abc"), "match");
assert(!aiKeysMatch("abc", "abcd"), "mismatch");
assert(!aiKeysMatch("", "abc"), "empty provided");

console.log("ai key extraction checks passed");
