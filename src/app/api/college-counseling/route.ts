import { NextResponse } from "next/server";
import {
  getHubUserId,
  isHubSyncConfigured,
  isRequestUnlocked,
} from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCollegeCounseling,
  saveCollegeCounseling,
} from "@/lib/supabase/college-counseling-repository";
import type { CollegeCounselingData } from "@/lib/college-counseling/types";

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

/** GET — load college counseling document for the hub user. */
export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    const data = await fetchCollegeCounseling(supabase, userId);
    return NextResponse.json({ userId, data });
  } catch (err) {
    console.error("[api/college-counseling]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load college counseling",
      },
      { status: 500 },
    );
  }
}

/** PUT — save full college counseling document. */
export async function PUT(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let body: { data?: CollegeCounselingData };
  try {
    body = (await request.json()) as { data?: CollegeCounselingData };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const userId = getHubUserId();
    const supabase = createAdminClient();
    await saveCollegeCounseling(supabase, userId, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/college-counseling]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to save college counseling",
      },
      { status: 500 },
    );
  }
}
