import { NextResponse } from "next/server";
import { isHubSyncConfigured, getHubUserId } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_CORS_HEADERS } from "@/lib/ai/key";
import {
  upsertBluebookAttempt,
  verifyIngestToken,
} from "@/lib/sat-practice/repository";
import { extractAiApiKey } from "@/lib/ai/key";
import { satPracticeErrorMessage } from "@/lib/sat-practice/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  ...AI_CORS_HEADERS,
  "Access-Control-Allow-Headers":
    `${AI_CORS_HEADERS["Access-Control-Allow-Headers"]}, x-sat-ingest-token`,
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function ingestToken(request: Request) {
  return (
    request.headers.get("x-sat-ingest-token") ||
    extractAiApiKey(request) ||
    ""
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  try {
    const token = ingestToken(request);
    if (!token) {
      return json({ ok: false, error: "Missing extension connect token" }, 401);
    }
    if (!isHubSyncConfigured()) {
      return json({ ok: false, error: "Hub sync is not configured" }, 503);
    }
    const supabase = createAdminClient();
    const userId = getHubUserId();
    const ok = await verifyIngestToken(supabase, token, userId);
    if (!ok) {
      return json(
        { ok: false, error: "Invalid extension connect token. Generate a new one on SAT Practice." },
        401,
      );
    }
    const rosterId = String(body.roster_id || body.rosterEntryId || "");
    if (!rosterId) return json({ ok: false, error: "roster_id required" }, 400);
    const attempt = await upsertBluebookAttempt(
      supabase,
      {
        roster_id: rosterId,
        title: typeof body.title === "string" ? body.title : undefined,
        started_at: typeof body.started_at === "string" ? body.started_at : undefined,
        official_total:
          body.official_total == null ? null : Number(body.official_total),
        official_rw: body.official_rw == null ? null : Number(body.official_rw),
        official_math:
          body.official_math == null ? null : Number(body.official_math),
        modules: body.modules,
        answers: body.answers,
      },
      userId,
    );
    return json({ ok: true, attempt, attempt_id: attempt.id, title: attempt.title });
  } catch (err) {
    const status = Number((err as { status?: number })?.status || 500);
    console.error("[sat-practice bluebook ingest]", err);
    return json(
      { ok: false, error: satPracticeErrorMessage(err, "Bluebook import failed") },
      status === 401 || status === 503 ? status : 500,
    );
  }
}
