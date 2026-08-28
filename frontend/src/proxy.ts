import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("omfai_token")?.value;
  const userCookie = request.cookies.get("omfai_user")?.value;
  const { pathname } = request.nextUrl;

  // Parsing user data jika cookie ada
  let user: any = null;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie);
    } catch (e) {
      // Abaikan error parsing cookie
    }
  }

  // 1. Jika mencoba mengakses halaman login tetapi sudah terautentikasi, redirect ke /dashboard
  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 2. Proteksi rute-rute dashboard (protected routes)
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/activities") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/piket") ||
    pathname.startsWith("/reports");

  if (isProtectedRoute) {
    // Jika tidak ada token, paksa login kembali
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // 3. Proteksi Berbasis Role (Role-based Authorization)
    const roles: string[] = user?.roles || [];

    // Admin-only pages
    if (pathname.startsWith("/users") || pathname.startsWith("/categories")) {
      if (!roles.includes("Admin")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    // Owner / Admin pages (Laporan)
    if (pathname.startsWith("/reports")) {
      if (!roles.includes("Owner") && !roles.includes("Admin")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

// Menentukan rute mana saja yang akan dievaluasi oleh proxy ini
export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/activities",
    "/activities/:path*",
    "/categories",
    "/categories/:path*",
    "/users",
    "/users/:path*",
    "/piket",
    "/piket/:path*",
    "/reports",
    "/reports/:path*",
  ],
};
