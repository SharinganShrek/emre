import { NextRequest, NextResponse } from "next/server";
import { isRequestUnlocked } from "@/lib/access";
import { sendSchema } from "@/lib/media-share";
import {
  exchangeErrorStatus,
  readJson,
  sendToFriend,
} from "@/lib/media-share-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Send something. Details are read here, not taken from the browser. */
export async function POST(request: NextRequest) {
  if (!(await isRequestUnlocked())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick something to send." }, { status: 400 });
  }

  const note = parsed.data.note?.trim() || null;
  try {
    const item = await sendToFriend(parsed.data.kind, parsed.data.sourceId, note);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const mapped = exchangeErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[exchange/send]", error);
    return NextResponse.json({ error: "Couldn't send it — try again." }, { status: 500 });
  }
}
