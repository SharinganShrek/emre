import { NextResponse } from "next/server";
import { isHubSyncConfigured, getHubUserId } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_CORS_HEADERS } from "@/lib/ai/key";
import {
  addUsedQuestions,
  completeModule,
  createAttemptFromIngest,
  saveAttemptHtml,
  upsertBluebookAttempt,
  usedQuestionLists,
  verifyIngestToken,
} from "@/lib/sat-practice/repository";
import { extractAiApiKey } from "@/lib/ai/key";
import { satPracticeErrorMessage } from "@/lib/sat-practice/errors";
import type { SatSection } from "@/lib/sat-practice/types";

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

async function admin() {
  if (!isHubSyncConfigured()) {
    throw Object.assign(new Error("Hub sync is not configured"), { status: 503 });
  }
  return { supabase: createAdminClient(), userId: getHubUserId() };
}

async function requireIngest(request: Request) {
  const token = ingestToken(request);
  if (!token) {
    throw Object.assign(new Error("Missing extension connect token"), {
      status: 401,
    });
  }
  const ctx = await admin();
  const ok = await verifyIngestToken(ctx.supabase, token, ctx.userId);
  if (!ok) {
    throw Object.assign(
      new Error("Invalid extension connect token. Generate a new one on SAT Practice."),
      { status: 401 },
    );
  }
  return ctx;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireIngest(request);
    const used = await usedQuestionLists(ctx.supabase, ctx.userId);
    return json({ ok: true, ...used });
  } catch (err) {
    return catchErr(err);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  const op = String(body.op || body.action || "start");
  try {
    if (op === "module") {
      const ctx = await admin();
      const attemptId = String(body.attempt_id || body.attemptId || "");
      const moduleToken = String(body.module_token || body.moduleToken || "");
      const module = Number(body.module) === 2 ? 2 : 1;
      if (!attemptId || !moduleToken) {
        return json({ ok: false, error: "attempt_id and module_token required" }, 400);
      }
      const result = await completeModule(
        ctx.supabase,
        {
          attemptId,
          moduleToken,
          module,
          answers: (body.answers as Record<string, string>) || {},
          flagged: (body.flagged as Record<string, boolean>) || {},
          seconds_spent: (body.seconds_spent as Record<string, number>) || {},
          seconds_left:
            body.seconds_left == null ? null : Number(body.seconds_left),
        },
        ctx.userId,
      );
      if (!result.ok) return json({ ok: false, error: result.error }, 401);
      return json({ ok: true, attempt: result.attempt });
    }

    const ctx = await requireIngest(request);
    const url = new URL(request.url);
    const opName = `${op} ${url.searchParams.get("op") || ""}`.toLowerCase();
    const looksBluebook =
      opName.includes("bluebook") ||
      Boolean(body.roster_id || body.rosterEntryId) ||
      Boolean(
        body.modules &&
          typeof body.modules === "object" &&
          (body.modules as { rw?: unknown; math?: unknown }).rw,
      );
    if (op === "html") {
      const attemptId = String(body.attempt_id || body.attemptId || "");
      const html = typeof body.html === "string" ? body.html : "";
      if (!attemptId || !html) {
        return json({ ok: false, error: "attempt_id and html required" }, 400);
      }
      await saveAttemptHtml(ctx.supabase, attemptId, html, ctx.userId);
      return json({ ok: true, attempt_id: attemptId });
    }
    if (op === "history" || op === "used") {
      const used = await addUsedQuestions(
        ctx.supabase,
        {
          external_ids: (body.external_ids as string[]) || [],
          content_hashes: (body.content_hashes as string[]) || [],
        },
        ctx.userId,
      );
      return json({ ok: true, ...used });
    }
    if (looksBluebook) {
      const rosterId = String(body.roster_id || body.rosterEntryId || "");
      if (!rosterId) {
        return json({ ok: false, error: "roster_id required" }, 400);
      }
      const attempt = await upsertBluebookAttempt(
        ctx.supabase,
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
        ctx.userId,
      );
      return json({ ok: true, attempt, attempt_id: attempt.id, title: attempt.title });
    }

    const section: SatSection = body.section === "math" ? "math" : "rw";
    const m1 = Array.isArray(body.m1) ? body.m1 : [];
    const m2 = Array.isArray(body.m2) ? body.m2 : [];
    if (!m1.length || !m2.length) {
      return json({ ok: false, error: "Both modules are required" }, 400);
    }
    const created = await createAttemptFromIngest(
      ctx.supabase,
      {
        section,
        m1,
        m2,
        html: typeof body.html === "string" ? body.html : undefined,
        stamp: typeof body.stamp === "string" ? body.stamp : undefined,
      },
      ctx.userId,
    );
    return json({
      ok: true,
      attempt_id: created.attempt.id,
      title: created.attempt.title,
      section: created.attempt.section,
      module_token: created.module_token,
    });
  } catch (err) {
    return catchErr(err);
  }
}

function catchErr(err: unknown) {
  const status = Number((err as { status?: number })?.status || 500);
  const message = satPracticeErrorMessage(err, "Ingest failed");
  console.error("[sat-practice ingest]", err);
  return json({ ok: false, error: message }, status === 401 || status === 503 ? status : 500);
}
