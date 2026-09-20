import { NextResponse } from "next/server";
import { satPracticeGuard } from "@/lib/sat-practice/guard";
import { rotateIngestToken, settingsSummary } from "@/lib/sat-practice/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<typeof gated, { error: NextResponse }>;
  try {
    const settings = await settingsSummary(supabase, userId);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load connection" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const gated = await satPracticeGuard();
  if ("error" in gated && gated.error) return gated.error;
  const { userId, supabase } = gated as Exclude<typeof gated, { error: NextResponse }>;
  try {
    const token = await rotateIngestToken(supabase, userId);
    return NextResponse.json({
      token,
      note: "Paste this once into the Opera extension. It is not the Custom GPT API key.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create token" },
      { status: 500 },
    );
  }
}
