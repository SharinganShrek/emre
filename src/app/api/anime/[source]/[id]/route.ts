import { NextResponse } from "next/server";
import { isRequestUnlocked } from "@/lib/access";
import { getAnime, isAnimeSource } from "@/lib/anime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string; id: string }> },
) {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const { source, id } = await context.params;
  if (!isAnimeSource(source)) {
    return NextResponse.json({ error: "Unknown anime archive." }, { status: 400 });
  }
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing anime id." }, { status: 400 });
  }

  try {
    const data = await getAnime(source, id.trim());
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api/anime/details]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not load that anime.",
      },
      { status: 502 },
    );
  }
}
