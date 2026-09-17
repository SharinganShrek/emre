import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import { movieInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/movies — list movies/anime. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("movies", "read");

    const { data, error } = await ctx.admin
      .from("movies")
      .select(
        "id,title,kind,status,rating,review,watched_date,source,external_id,image_url,title_english,anime_type,episodes,episodes_watched,year,genres,community_score",
      )
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/movies",
      action: "read",
      resource: "movies",
      summary: `Listed ${data?.length ?? 0} movies`,
    });

    return aiOk(data ?? []);
  } catch (err) {
    return aiCatch(err);
  }
}

/** POST /api/ai/movies — add a movie/anime to the list. */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("movies", "write");

    const body = movieInput.parse(await request.json());

    const { data, error } = await ctx.admin
      .from("movies")
      .insert({
        user_id: ctx.userId,
        title: body.title,
        kind: "anime",
        status: body.status,
        rating: body.rating ?? null,
        review: body.review ?? null,
        watched_date: body.watched_date ?? null,
        source: body.source ?? "mal",
        external_id: body.external_id ?? null,
        episodes: body.episodes ?? null,
        episodes_watched: body.episodes_watched ?? 0,
      })
      .select()
      .single();

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/movies",
      action: "write",
      resource: "movies",
      summary: `Added "${body.title}" (${body.status})`,
      metadata: { movie_id: data.id },
    });

    return aiOk(data, { status: 201 });
  } catch (err) {
    return aiCatch(err);
  }
}
