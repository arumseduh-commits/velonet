import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect Student Routes (/student/* except /student/login)
  if (pathname.startsWith("/student") && !pathname.startsWith("/student/login")) {
    const studentToken = req.cookies.get("velo_student_session")?.value;
    if (!studentToken) {
      const loginUrl = new URL("/student/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Admin Routes protection: Only enforce strict redirect if ADMIN_AUTH_STRICT === "true" in production
  if (
    process.env.ADMIN_AUTH_STRICT === "true" &&
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    const adminToken = req.cookies.get("velo_admin_session")?.value;
    if (!adminToken) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
