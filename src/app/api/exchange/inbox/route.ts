import { NextRequest, NextResponse } from "next/server";
import { verifyFriendToken } from "@/lib/access-edge";
import { parseInbox } from "@/lib/media-share";
import {
  exchangeErrorStatus,
  readJson,
  receive,
} from "@/lib/media-share-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The friend's site delivers an item. Answers `{ dueAt }` from this site's clock. */
export async function POST(request: NextRequest) {
  if (
    !(await verifyFriendToken(
      request.headers.get("authorization"),
      process.env.EXCHANGE_TOKEN,
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseInbox(await readJson(request));
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.issues },
      { status: 400 },
    );
  }

  try {
    const outcome = await receive(parsed.data);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ dueAt: outcome.dueAt }, { status: 201 });
  } catch (error) {
    const mapped = exchangeErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    console.error("[exchange/inbox]", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
