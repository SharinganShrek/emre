import { NextResponse } from "next/server";
import { satPracticeErrorMessage } from "@/lib/sat-practice/errors";
import { satPracticeGuard } from "@/lib/sat-practice/guard";
import { getAttemptHtml } from "@/lib/sat-practice/repository";

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
    const row = await getAttemptHtml(supabase, id, userId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!row.source_html) {
      return NextResponse.json({ error: "No HTML saved for this mock" }, { status: 404 });
    }
    const filename = `${row.title.replace(/\s+/g, "_")}.html`;
    return new NextResponse(row.source_html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[api/sat-practice/html]", err);
    return NextResponse.json(
      { error: satPracticeErrorMessage(err, "Failed to load HTML") },
      { status: 500 },
    );
  }
}
