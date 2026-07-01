import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/jwt";

const privatePrefixes = ["/dashboard", "/movements", "/upload", "/statistics", "/profile", "/admin"];
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

  if (pathname === "/login") {
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.next();
    }

    try {
      await verifyAccessToken(token);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch {
      return NextResponse.next();
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
    "/api/:path*"
  ]
};
