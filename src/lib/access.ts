import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { UNLOCK_COOKIE } from "@/lib/access-edge";

export { UNLOCK_COOKIE };

/** Fixed app password from env. Empty = gate disabled (local/dev). */
export function getAppPassword(): string | null {
  const value = process.env.APP_PASSWORD?.trim();
  return value ? value : null;
}

export function isPasswordGateEnabled(): boolean {
  return getAppPassword() !== null;
}

/** Must match `hashUnlockToken` in access-edge.ts (SHA-256 of prefix+password). */
export function unlockToken(): string {
  const password = getAppPassword();
  if (!password) return "";
  return createHash("sha256")
    .update(`emre-hub-unlock-v1:${password}`)
    .digest("hex");
}

export function tokenMatches(cookieValue: string | undefined): boolean {
  const expected = unlockToken();
  if (!expected || !cookieValue) return false;
  try {
    const a = Buffer.from(cookieValue);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Server Components / Route Handlers: is the current request unlocked? */
export async function isRequestUnlocked(): Promise<boolean> {
  if (!isPasswordGateEnabled()) return true;
  const jar = await cookies();
  return tokenMatches(jar.get(UNLOCK_COOKIE)?.value);
}

/**
 * Built-in owner UUID for all hub rows (no Supabase Auth / no env needed).
 * Override only if you already have data under a different id.
 */
export const DEFAULT_HUB_USER_ID =
  "00000000-0000-0000-0000-000000000001";

export function getHubUserId(): string {
  return (
    process.env.HUB_USER_ID?.trim() ||
    process.env.AI_USER_ID?.trim() ||
    DEFAULT_HUB_USER_ID
  );
}

export function isHubSyncConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
