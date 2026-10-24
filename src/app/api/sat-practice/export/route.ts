import { NextResponse } from "next/server";
import { satPracticeErrorMessage } from "@/lib/sat-practice/errors";
import { satPracticeGuard } from "@/lib/sat-practice/guard";
import { allCompletedAttempts } from "@/lib/sat-practice/repository";
import { buildResultsReport } from "@/lib/sat-practice/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<
    typeof gated,
    { error: NextResponse }
  >;
  try {
    const attempts = await allCompletedAttempts(supabase, userId);
    if (!attempts.length) {
      return NextResponse.json(
        { error: "No completed SAT practice mocks yet." },
        { status: 404 },
      );
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const body = attempts
      .map((attempt) => {
        const when = (attempt.completed_at || attempt.created_at || "").slice(0, 10);
        return [
          `===== ${attempt.title} · ${attempt.section} · ${when} =====`,
          buildResultsReport(attempt).trimEnd(),
        ].join("\n");
      })
      .join("\n\n");
    return new NextResponse(`${body}\n`, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="sat-practice-reports-${stamp}.txt"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/sat-practice/export]", err);
    return NextResponse.json(
      { error: satPracticeErrorMessage(err, "Failed to build the report") },
      { status: 500 },
    );
  }
}
