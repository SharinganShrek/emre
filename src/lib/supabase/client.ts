"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

export { isSupabaseConfigured } from "./config";

/** Browser Supabase client (anon key). RLS enforces per-user access. */
export function createClient(): SupabaseClient {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient(config.url, config.anonKey);
}

/** Returns null when Supabase is not configured (local mock mode). */
export function createClientIfConfigured(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
