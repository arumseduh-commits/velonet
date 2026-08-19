import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { processFaceAttendance } from "@/lib/face-recognition";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    const body = await req.json();
    const { faceDescriptor, latitude, longitude, photoBase64, threshold } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DESCRIPTOR",
          error: "Vektor biometrik wajah tidak valid (harus 128-dimensi).",
        },
        { status: 400 }
      );
    }

    const result = await processFaceAttendance({
      prisma,
      queryDescriptor: faceDescriptor,
      loggedInUserId: student?.id,
      latitude: typeof latitude === "number" ? latitude : undefined,
      longitude: typeof longitude === "number" ? longitude : undefined,
      photoBase64: typeof photoBase64 === "string" ? photoBase64 : undefined,
      threshold: typeof threshold === "number" ? threshold : 0.50,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[FaceCheckInAPI] Error:", err);
    return NextResponse.json(
      {
        success: false,
        code: "ERROR",
        error: err.message || "Terjadi kesalahan pada server saat memproses absensi wajah.",
      },
      { status: 500 }
    );
  }
}
