import { NextResponse } from "next/server";
import { logoutStudent } from "@/lib/student-auth";

export async function POST() {
  await logoutStudent();
  return NextResponse.json({ success: true, message: "Berhasil keluar." });
}
