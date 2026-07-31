import { NextResponse } from "next/server";
import {
  getHubUserId,
  isHubSyncConfigured,
  isRequestUnlocked,
} from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchSatVocabProgress,
  saveSatVocabProgress,
} from "@/lib/supabase/sat-vocab-repository";
import type { SatVocabProgress } from "@/lib/sat-vocab/types";
import { recomputeCompletedDates } from "@/lib/sat-vocab";

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
    const data = await fetchSatVocabProgress(supabase, userId);
    return NextResponse.json({ userId, data });
  } catch (err) {
    console.error("[api/sat-vocab]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load SAT vocab progress",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let body: { data?: SatVocabProgress };
  try {
    body = (await request.json()) as { data?: SatVocabProgress };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    const payload = {
      ...body.data,
      completed_dates: recomputeCompletedDates(body.data),
    };
    await saveSatVocabProgress(supabase, userId, payload);
    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[api/sat-vocab]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save SAT vocab progress",
      },
      { status: 500 },
    );
  }
}
