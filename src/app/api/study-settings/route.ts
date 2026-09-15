import { NextResponse } from "next/server";
import {
  getHubUserId,
  isHubSyncConfigured,
  isRequestUnlocked,
} from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchStudySettings,
  saveStudySettings,
} from "@/lib/supabase/study-settings-repository";
import { mergeSettings, type YptSettings } from "@/lib/study/ypt";

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

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    const data = await fetchStudySettings(supabase, userId);
    return NextResponse.json({ userId, data });
  } catch (err) {
    console.error("[api/study-settings]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load study settings",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let body: { data?: Partial<YptSettings> };
  try {
    body = (await request.json()) as { data?: Partial<YptSettings> };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    const payload = mergeSettings(body.data);
    if (payload.subjects.length === 0) {
      return NextResponse.json(
        { error: "At least one subject is required" },
        { status: 400 },
      );
    }
    await saveStudySettings(supabase, userId, payload);
    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[api/study-settings]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save study settings",
      },
      { status: 500 },
    );
  }
}
