import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE, tokenMatches } from "@/lib/access-edge";
import { AI_CORS_HEADERS } from "@/lib/ai/key";

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

  const ingestPath = pathname.startsWith("/api/sat-practice/ingest");

  if (
    (pathname.startsWith("/api/ai") ||
      pathname.startsWith("/api/mcp") ||
      ingestPath) &&
    request.method === "OPTIONS"
  ) {
    return new NextResponse(null, { status: 204, headers: AI_CORS_HEADERS });
  }

  const requestHeaders = new Headers(request.headers);
  const passThrough = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    if (
      pathname.startsWith("/api/ai") ||
      pathname.startsWith("/api/mcp") ||
      ingestPath
    ) {
      for (const [key, value] of Object.entries(AI_CORS_HEADERS)) {
        response.headers.set(key, value);
      }
    }
    return response;
  };

  const isPublic =
    pathname === "/unlock" ||
    pathname.startsWith("/api/unlock") ||
    pathname.startsWith("/api/ai") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/sat-practice/ingest") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest";

  if (!password || isPublic) {
    return passThrough();
  }

  // API routes: let the route return JSON 401 (don't HTML-redirect).
  const cookie = request.cookies.get(UNLOCK_COOKIE)?.value;
  const unlocked = await tokenMatches(cookie, password);

  if (unlocked) {
    return passThrough();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}
