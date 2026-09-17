import { NextResponse } from "next/server";
import { isRequestUnlocked } from "@/lib/access";
import { isAnimeSource, searchAnime } from "@/lib/anime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const sourceRaw = searchParams.get("source")?.trim() || "anilist";

  if (!isAnimeSource(sourceRaw)) {
    return NextResponse.json({ error: "Unknown anime archive." }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ data: [] });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  }

  try {
    const data = await searchAnime(sourceRaw, q);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api/anime/search]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not search the anime archive.",
      },
      { status: 502 },
    );
  }
}
