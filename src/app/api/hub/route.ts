import { NextResponse } from "next/server";
import {
  getHubUserId,
  isHubSyncConfigured,
  isRequestUnlocked,
} from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteSyncedRow,
  fetchSyncedHubData,
  insertSyncedRow,
  isSyncedCollection,
  updateProfile,
  updateSyncedRow,
  upsertHabitLog,
  type SyncedCollection,
} from "@/lib/supabase/hub-repository";
import type { HabitLog, Profile } from "@/lib/types";

async function guard() {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  if (!isHubSyncConfigured()) {
    return NextResponse.json(
      { error: "Hub sync is not configured (need SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }
  return null;
}

/** GET — load all synced hub data for the fixed hub user. */
export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    const data = await fetchSyncedHubData(supabase, userId);
    return NextResponse.json({ userId, ...data });
  } catch (err) {
    console.error("[api/hub]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load hub data" },
      { status: 500 },
    );
  }
}

type HubAction =
  | { action: "insert"; collection: SyncedCollection; row: Record<string, unknown> }
  | {
      action: "update";
      collection: SyncedCollection;
      id: string;
      patch: Record<string, unknown>;
    }
  | { action: "delete"; collection: SyncedCollection; id: string }
  | { action: "upsertHabitLog"; log: HabitLog }
  | { action: "updateProfile"; patch: Partial<Profile> };

/** POST — mutate synced rows (service role, scoped to HUB_USER_ID). */
export async function POST(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let body: HubAction;
  try {
    body = (await request.json()) as HubAction;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();

    switch (body.action) {
      case "insert": {
        if (!isSyncedCollection(body.collection)) {
          return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
        }
        await insertSyncedRow(supabase, body.collection, body.row, userId);
        break;
      }
      case "update": {
        if (!isSyncedCollection(body.collection)) {
          return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
        }
        await updateSyncedRow(
          supabase,
          body.collection,
          body.id,
          body.patch,
          userId,
        );
        break;
      }
      case "delete": {
        if (!isSyncedCollection(body.collection)) {
          return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
        }
        await deleteSyncedRow(supabase, body.collection, body.id, userId);
        break;
      }
      case "upsertHabitLog": {
        await upsertHabitLog(supabase, body.log, userId);
        break;
      }
      case "updateProfile": {
        await updateProfile(supabase, userId, body.patch);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/hub]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mutation failed" },
      { status: 500 },
    );
  }
}
