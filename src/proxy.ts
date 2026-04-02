// Next.js 16: "middleware" file convention is deprecated — use "proxy" instead.
// This file replaces src/middleware.ts.
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn  = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  // Redirect unauthenticated users away from the dashboard
  if (isDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from the login page
  if (req.nextUrl.pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard/markets", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run proxy on dashboard and login pages only
  matcher: ["/dashboard/:path*", "/login"],
};
