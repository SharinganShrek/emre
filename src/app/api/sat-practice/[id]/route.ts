import { NextResponse } from "next/server";
import { satPracticeErrorMessage } from "@/lib/sat-practice/errors";
import { satPracticeGuard } from "@/lib/sat-practice/guard";
import { getAttempt, patchAttempt } from "@/lib/sat-practice/repository";
import { buildResultsReport } from "@/lib/sat-practice/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<typeof gated, { error: NextResponse }>;
  const { id } = await context.params;
  try {
    const attempt = await getAttempt(supabase, id, userId);
    if (!attempt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const report = buildResultsReport(attempt);
    return NextResponse.json({ attempt, report });
  } catch (err) {
    console.error("[api/sat-practice/id]", err);
    return NextResponse.json(
      { error: satPracticeErrorMessage(err, "Failed to load attempt") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<typeof gated, { error: NextResponse }>;
  const { id } = await context.params;
  let body: { include_timing_in_report?: boolean };
  try {
    body = (await request.json()) as { include_timing_in_report?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const attempt = await patchAttempt(
      supabase,
      id,
      { include_timing_in_report: body.include_timing_in_report },
      userId,
    );
    return NextResponse.json({ attempt });
  } catch (err) {
    console.error("[api/sat-practice/id patch]", err);
    return NextResponse.json(
      { error: satPracticeErrorMessage(err, "Failed to update attempt") },
      { status: 500 },
    );
  }
}
