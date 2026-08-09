import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOrigins } from "@/lib/env";
import { lookupSessionVersion } from "@/lib/db/session-version";
import { applySecurityHeaders } from "@/lib/security-headers";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session-token";

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

function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });
}

function unauthorized(
  request: NextRequest,
  clearCurrentCookie: boolean,
): NextResponse {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      )
    : NextResponse.redirect(new URL("/login", request.url));

  if (clearCurrentCookie) clearCookie(response, SESSION_COOKIE_NAME);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPage = PUBLIC_PAGES.has(pathname);
  const isPublicApi = PUBLIC_APIS.has(pathname);
  const isPublic = isPublicPage || isPublicApi;
  const legacySessionPresent =
    SESSION_COOKIE_NAME !== LEGACY_SESSION_COOKIE_NAME &&
    request.cookies.has(LEGACY_SESSION_COOKIE_NAME);
  const finish = (response: NextResponse) => {
    if (legacySessionPresent) {
      clearCookie(response, LEGACY_SESSION_COOKIE_NAME);
    }
    return finalize(response);
  };

  if (pathname.startsWith("/api/") && UNSAFE_METHODS.has(request.method)) {
    try {
      const origin = request.headers.get("origin");
      if (!origin || !getAllowedOrigins().has(origin)) {
        return finish(
          NextResponse.json(
            { error: "Invalid request origin", code: "INVALID_ORIGIN" },
            { status: 403 },
          ),
        );
      }
    } catch (error) {
      console.error("Origin configuration error:", error);
      return finish(
        NextResponse.json(
          {
            error: "Security configuration unavailable",
            code: "SECURITY_CONFIGURATION_UNAVAILABLE",
          },
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
      return finish(
        NextResponse.json(
          {
            error: "Authentication configuration unavailable",
            code: "AUTHENTICATION_CONFIGURATION_UNAVAILABLE",
          },
          { status: 503 },
        ),
      );
    }
  }

  if (!sessionValid && !isPublic) {
    return finish(unauthorized(request, Boolean(token)));
  }

  if (sessionValid && isPublicPage) {
    return finish(NextResponse.redirect(new URL("/library", request.url)));
  }

  const response = NextResponse.next();
  if (token && !sessionValid && !isPublicApi) {
    clearCookie(response, SESSION_COOKIE_NAME);
  }
  return finish(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
