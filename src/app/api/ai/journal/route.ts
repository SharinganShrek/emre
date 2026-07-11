import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import { journalInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/journal — create (or update today's) journal entry.
 * Non-destructive: uses upsert on (user_id, entry_date) via manual check.
 */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("journal_entries", "write");

    const body = journalInput.parse(await request.json());
    const entry_date = body.entry_date ?? new Date().toISOString().slice(0, 10);

    // Upsert-like behavior without a DB unique constraint: check first.
    const { data: existing } = await ctx.admin
      .from("journal_entries")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("entry_date", entry_date)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await ctx.admin
        .from("journal_entries")
        .update({ mood: body.mood, content: body.content })
        .eq("id", existing.id)
        .eq("user_id", ctx.userId)
        .select()
        .single();
      if (error) return aiError(error.message, 500);
      result = data;
    } else {
      const { data, error } = await ctx.admin
        .from("journal_entries")
        .insert({
          user_id: ctx.userId,
          entry_date,
          mood: body.mood,
          content: body.content,
        })
        .select()
        .single();
      if (error) return aiError(error.message, 500);
      result = data;
    }

    await logAiAction({
      ctx,
      route: "/api/ai/journal",
      action: "write",
      resource: "journal_entries",
      summary: `${existing ? "Updated" : "Created"} journal entry for ${entry_date}`,
      metadata: { entry_date, mood: body.mood },
    });

    return aiOk(result, { status: existing ? 200 : 201 });
  } catch (err) {
    return aiCatch(err);
  }
}
