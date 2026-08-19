import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const adminToken = req.cookies.get("velo_admin_session")?.value;
  const studentToken = req.cookies.get("velo_student_session")?.value;

  // 1. Protect Admin Routes (/admin/* except /admin/login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!adminToken) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Protect Mentor Routes (/mentor/* except /mentor/login)
  if (pathname.startsWith("/mentor") && !pathname.startsWith("/mentor/login")) {
    if (!adminToken) { // Assuming mentors use admin token or similar
      const loginUrl = new URL("/mentor/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Protect Student Routes (/student/* except /student/login & /student/expired)
  if (
    pathname.startsWith("/student") &&
    !pathname.startsWith("/student/login") &&
    !pathname.startsWith("/student/expired")
  ) {
    if (!studentToken && !adminToken) {
      const loginUrl = new URL("/student/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/mentor/:path*", "/student/:path*"],
};
