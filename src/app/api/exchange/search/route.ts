import { NextRequest, NextResponse } from "next/server";
import { isRequestUnlocked } from "@/lib/access";
import {
  QUERY_MAX,
  SHARE_KINDS,
  minQueryLength,
  type ShareKind,
} from "@/lib/media-share";
import { exchangeErrorStatus, searchKind } from "@/lib/media-share-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Search a catalogue to pick something to send: `?kind=anime&q=frieren`. */
export async function GET(request: NextRequest) {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  if (!(SHARE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json(
      { error: "Pick movie, tv, anime, manga or book." },
      { status: 400 },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const least = minQueryLength(kind as ShareKind);
  if (query.length < least) {
    return NextResponse.json(
      {
        error: `Type at least ${least === 3 ? "three" : "two"} letters to search.`,
      },
      { status: 400 },
    );
  }
  if (query.length > QUERY_MAX) {
    return NextResponse.json({ error: "That search is too long." }, { status: 400 });
  }

  try {
    return NextResponse.json({ results: await searchKind(kind as ShareKind, query) });
  } catch (error) {
    const mapped = exchangeErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[exchange/search]", error);
    return NextResponse.json({ error: "Search failed — try again." }, { status: 500 });
  }
}
