import { NextRequest, NextResponse } from "next/server";
import { verifyFriendToken } from "@/lib/access-edge";
import { finishedSchema } from "@/lib/media-share";
import {
  exchangeErrorStatus,
  friendFinished,
  readJson,
} from "@/lib/media-share-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The friend's site says they finished what was sent from here. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (
    !(await verifyFriendToken(
      request.headers.get("authorization"),
      process.env.EXCHANGE_TOKEN,
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!ID.test(id)) {
    return NextResponse.json(
      { error: "Nothing like that was sent from here." },
      { status: 404 },
    );
  }

  const parsed = finishedSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send finishedAt as an ISO date." },
      { status: 400 },
    );
  }

  try {
    const saved = await friendFinished(id, new Date(parsed.data.finishedAt));
    if (!saved) {
      return NextResponse.json(
        { error: "Nothing like that was sent from here." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = exchangeErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[exchange/inbox/finished]", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
