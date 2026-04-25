import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isRole } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login routes live under /admin and /manager; they must be public or every visit
  // redirects to the same URL (infinite redirect) and sign-in never works.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }
  if (pathname === "/manager/login" || pathname.startsWith("/manager/login/")) {
    return NextResponse.next();
  }
  if (pathname === "/dashboard/login" || pathname.startsWith("/dashboard/login/")) {
    return NextResponse.next();
  }
  if (pathname === "/spc/login" || pathname.startsWith("/spc/login/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/forms")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || (role !== "user" && role !== "manager")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/manager")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || role !== "manager") {
      const url = req.nextUrl.clone();
      url.pathname = "/manager/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/dashboard")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || role !== "dashboard") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/spc")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || role !== "spc") {
      const url = req.nextUrl.clone();
      url.pathname = "/spc/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/chatai")) {
    const role = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isRole(role) || role !== "manager") {
      const url = req.nextUrl.clone();
      url.pathname = "/manager/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/forms/:path*",
    "/manager/:path*",
    "/dashboard/:path*",
    "/spc",
    "/spc/:path*",
    "/chatai",
    "/chatai/:path*",
  ],
};

