/** Edge-safe unlock helpers (middleware). Matches Node `unlockToken()` in access.ts. */

export const UNLOCK_COOKIE = "emre_hub_unlocked";

export async function hashUnlockToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`emre-hub-unlock-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tokenMatches(
  cookieValue: string | undefined,
  password: string,
): Promise<boolean> {
  if (!cookieValue || !password) return false;
  const expected = await hashUnlockToken(password);
  if (cookieValue.length !== expected.length) return false;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (cookieValue[i] !== expected[i]) ok = false;
  }
  return ok;
}

const EXCHANGE_TOKEN_MIN_LENGTH = 32;
const exchangeEncoder = new TextEncoder();

/**
 * Bearer check for the friend's site. Fails closed when the token is missing
 * or shorter than 32 characters. Compares SHA-256 digests with no early exit.
 */
export async function verifyFriendToken(
  header: string | null,
  expected: string | undefined,
): Promise<boolean> {
  const want = expected?.trim();
  if (!want || want.length < EXCHANGE_TOKEN_MIN_LENGTH) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const presented = header.slice("Bearer ".length).trim();
  if (presented === "") return false;

  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", exchangeEncoder.encode(presented)),
    crypto.subtle.digest("SHA-256", exchangeEncoder.encode(want)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

/** The friend's token may call these two POSTs and nothing else. */
export function friendMayCall(method: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const call = `${method.toUpperCase()} ${path.toLowerCase()}`;
  return (
    call === "POST /api/exchange/inbox" ||
    /^POST \/api\/exchange\/inbox\/[0-9a-f-]{36}\/finished$/.test(call)
  );
}
