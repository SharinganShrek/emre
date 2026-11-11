import { NextRequest, NextResponse } from "next/server";
import { isRequestUnlocked } from "@/lib/access";
import { exchangeErrorStatus, finishReceived } from "@/lib/media-share-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark what the friend sent as finished, then tell their site. */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!ID.test(id)) {
    return NextResponse.json(
      { error: "Nothing like that came from them." },
      { status: 404 },
    );
  }

  try {
    const item = await finishReceived(id);
    if (!item) {
      return NextResponse.json(
        { error: "Nothing like that came from them." },
        { status: 404 },
      );
    }
    return NextResponse.json({ item });
  } catch (error) {
    const mapped = exchangeErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[exchange/finish]", error);
    return NextResponse.json({ error: "Couldn't save that — try again." }, { status: 500 });
  }
}
