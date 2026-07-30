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
