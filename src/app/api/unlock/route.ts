import { NextResponse } from "next/server";
import {
  UNLOCK_COOKIE,
  getAppPassword,
  isPasswordGateEnabled,
  unlockToken,
} from "@/lib/access";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function POST(request: Request) {
  if (!isPasswordGateEnabled()) {
    const res = NextResponse.json({ ok: true, gate: false });
    return res;
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const expected = getAppPassword();
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, unlockToken(), COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
