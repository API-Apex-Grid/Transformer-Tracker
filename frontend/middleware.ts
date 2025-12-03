import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = new Set<string>(["/", "/under-construction"]);
const PUBLIC_API_ROUTES = new Set<string>(["/api/login", "/api/logout"]);

const isAssetRequest = (pathname: string): boolean =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon") ||
  pathname.startsWith("/assets") ||
  pathname.startsWith("/manifest") ||
  pathname.endsWith(".png") ||
  pathname.endsWith(".jpg") ||
  pathname.endsWith(".svg") ||
  pathname.endsWith(".css") ||
  pathname.endsWith(".js");

const isUnderConstructionEnabled = (): boolean =>
  (process.env.UNDER_CONSTRUCTION ?? "").trim().toLowerCase() === "true";

const isSunsetEnabled = (): boolean =>
  (process.env.SUNSET ?? "").trim().toLowerCase() === "true";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetRequest(pathname)) {
    return NextResponse.next();
  }

  if (isSunsetEnabled()) {
    if (pathname === "/sunset") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/sunset";
    url.search = "";
    if (pathname.startsWith("/api")) {
      return NextResponse.redirect(url, { status: 307 });
    }
    return NextResponse.redirect(url);
  }

  if (isUnderConstructionEnabled()) {
    if (pathname === "/under-construction") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/under-construction";
    url.search = "";
    if (pathname.startsWith("/api")) {
      return NextResponse.redirect(url, { status: 307 });
    }
    return NextResponse.redirect(url);
  }

  const loggedInCookie = request.cookies.get("tt_logged_in")?.value;
  const tokenCookie = request.cookies.get("tt_token")?.value;
  const isLoggedIn = loggedInCookie === "1" || typeof tokenCookie === "string";

  if (!isLoggedIn) {
    if (pathname.startsWith("/api")) {
      if (PUBLIC_API_ROUTES.has(pathname)) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!PUBLIC_ROUTES.has(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isLoggedIn && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/transformer";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
};