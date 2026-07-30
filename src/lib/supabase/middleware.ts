import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE, tokenMatches } from "@/lib/access-edge";

/**
 * Password gate only — no Supabase Auth.
 * If APP_PASSWORD is unset/empty, all routes are open.
 *
 * Note: read env with a static key so Next can inline it for the Edge runtime.
 */
export async function updateSession(request: NextRequest) {
  // Static access — required for Edge middleware env inlining.
  const rawPassword = process.env.APP_PASSWORD;
  const password =
    typeof rawPassword === "string" ? rawPassword.trim() : "";
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/unlock" ||
    pathname.startsWith("/api/unlock") ||
    pathname.startsWith("/api/ai") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest";

  if (!password || isPublic) {
    return NextResponse.next({ request });
  }

  // API routes: let the route return JSON 401 (don't HTML-redirect).
  const cookie = request.cookies.get(UNLOCK_COOKIE)?.value;
  const unlocked = await tokenMatches(cookie, password);

  if (unlocked) {
    return NextResponse.next({ request });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}
