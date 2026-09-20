import { NextResponse } from "next/server";
import {
  getHubUserId,
  isHubSyncConfigured,
  isRequestUnlocked,
} from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function satPracticeGuard() {
  if (!(await isRequestUnlocked())) {
    return {
      error: NextResponse.json({ error: "Locked" }, { status: 401 }),
    };
  }
  if (!isHubSyncConfigured()) {
    return {
      error: NextResponse.json(
        {
          error:
            "Hub sync is not configured. Set Supabase env vars and run supabase/sat_practice_schema.sql.",
        },
        { status: 503 },
      ),
    };
  }
  try {
    return { userId: getHubUserId(), supabase: createAdminClient() };
  } catch (err) {
    return {
      error: NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Supabase is not configured",
        },
        { status: 503 },
      ),
    };
  }
}
