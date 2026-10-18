import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/jwt";

const privatePrefixes = ["/dashboard", "/movements", "/upload", "/statistics", "/profile", "/admin", "/accounts", "/categories", "/planning", "/statements"];
const adminPrefixes = ["/admin", "/api/admin"];

function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function unauthorized(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function forbidden(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Permiso de administrador requerido." }, { status: 403 });
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Session validity is checked against the database in layouts and handlers.
  // Do not redirect /login solely on a JWT: the database session may be revoked.
  if (pathname === "/login") return NextResponse.next();

  if (isApiPath(pathname) && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? request.nextUrl.host;
    let sameOrigin = !origin;
    try { if (origin) sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; }
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Origen de la petición no permitido." }, { status: 403 });
    }
  }

  const needsAuth = isPrivatePath(pathname) || (isApiPath(pathname) && !pathname.startsWith("/api/auth/login"));
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return unauthorized(request);
  }

  try {
    const payload = await verifyAccessToken(token);
    const needsAdmin = adminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

    if (needsAdmin && payload.role !== "ADMIN") {
      return forbidden(request);
    }

    return NextResponse.next();
  } catch {
    return unauthorized(request);
  }
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/movements/:path*",
    "/upload/:path*",
    "/statistics/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/accounts/:path*",
    "/categories/:path*",
    "/planning/:path*",
    "/statements/:path*",
    "/api/:path*"
  ]
};
