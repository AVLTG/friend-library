import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOrigins } from "@/lib/env";
import { lookupSessionVersion } from "@/lib/db/session-version";
import { applySecurityHeaders } from "@/lib/security-headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";

const PUBLIC_PAGES = new Set(["/login", "/register"]);
const PUBLIC_APIS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/setup",
  "/api/auth/check-setup",
]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function finalize(response: NextResponse): NextResponse {
  applySecurityHeaders(response.headers);
  return response;
}

function clearInvalidSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });
}

function unauthorized(request: NextRequest, clearCookie: boolean): NextResponse {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));

  if (clearCookie) clearInvalidSession(response);
  return finalize(response);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPage = PUBLIC_PAGES.has(pathname);
  const isPublicApi = PUBLIC_APIS.has(pathname);
  const isPublic = isPublicPage || isPublicApi;

  if (pathname.startsWith("/api/") && UNSAFE_METHODS.has(request.method)) {
    try {
      const origin = request.headers.get("origin");
      if (!origin || !getAllowedOrigins().has(origin)) {
        return finalize(
          NextResponse.json({ error: "Invalid request origin" }, { status: 403 }),
        );
      }
    } catch (error) {
      console.error("Origin configuration error:", error);
      return finalize(
        NextResponse.json(
          { error: "Security configuration unavailable" },
          { status: 503 },
        ),
      );
    }
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let sessionValid = false;

  if (token) {
    try {
      const session = await verifySessionToken(token);
      if (session) {
        const version = await lookupSessionVersion(session.userId);
        sessionValid =
          !version.checked || version.sessionVersion === session.sessionVersion;
      }
    } catch (error) {
      console.error("Session verification error:", error);
      return finalize(
        NextResponse.json(
          { error: "Authentication configuration unavailable" },
          { status: 503 },
        ),
      );
    }
  }

  if (!sessionValid && !isPublic) {
    return unauthorized(request, Boolean(token));
  }

  if (sessionValid && isPublicPage) {
    return finalize(NextResponse.redirect(new URL("/library", request.url)));
  }

  const response = NextResponse.next();
  if (token && !sessionValid && !isPublicApi) clearInvalidSession(response);
  return finalize(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
