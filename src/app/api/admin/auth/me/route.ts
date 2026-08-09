import { NextResponse } from "next/server";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getLoggedInAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: admin });
}
