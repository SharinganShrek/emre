import { NextResponse } from "next/server";
import { satPracticeGuard } from "@/lib/sat-practice/guard";
import { listAttempts, settingsSummary } from "@/lib/sat-practice/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<typeof gated, { error: NextResponse }>;
  try {
    const [attempts, settings] = await Promise.all([
      listAttempts(supabase, userId),
      settingsSummary(supabase, userId),
    ]);
    return NextResponse.json({ attempts, settings });
  } catch (err) {
    console.error("[api/sat-practice]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load SAT practice data",
      },
      { status: 500 },
    );
  }
}
