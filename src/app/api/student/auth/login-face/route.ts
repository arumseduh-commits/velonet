import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestFaceMatch } from "@/lib/face-recognition";
import { createStudentSession } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { faceDescriptor } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        { success: false, error: "Vektor biometrik wajah tidak valid (harus 128 dimensi)." },
        { status: 400 }
      );
    }

    // 1. Fetch all registered users who have a recorded face
    const candidateUsers = await prisma.user.findMany({
      where: {
        faceDescriptor: { not: null },
        isExcluded: false,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        studentClass: true,
        gender: true,
        faceDescriptor: true,
        facePhoto: true,
        isCompleted: true,
      },
    });

    if (candidateUsers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_ENROLLED_FACES",
          error: "Belum ada data wajah peserta yang terdaftar di sistem. Silakan login via WhatsApp terlebih dahulu untuk merekam wajah.",
        },
        { status: 404 }
      );
    }

    // 2. Perform Biometric Euclidean Matching (Strict threshold 0.45 = ~75%+ similarity)
    const matchResult = findBestFaceMatch(faceDescriptor, candidateUsers, 0.45);

    if (!matchResult.isMatch || !matchResult.matchedUser) {
      return NextResponse.json(
        {
          success: false,
          code: "UNKNOWN_FACE",
          error: "Wajah tidak dikenali atau belum terdaftar di sistem. Silakan login menggunakan WhatsApp atau Password.",
        },
        { status: 401 }
      );
    }

    const matchedUser = matchResult.matchedUser;

    // 3. Extract request metadata
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    // 4. Create Student Session & Set HTTP-Only Cookie
    await createStudentSession(matchedUser.id, userAgent, ipAddress);

    // Determine redirect destination
    const redirectUrl = matchedUser.isCompleted ? "/student" : "/student/complete-profile";

    return NextResponse.json({
      success: true,
      message: `Selamat datang kembali, ${matchedUser.name || "Siswa"}!`,
      redirectUrl,
      student: {
        id: matchedUser.id,
        name: matchedUser.name,
        studentClass: matchedUser.studentClass,
        phoneNumber: matchedUser.phoneNumber,
      },
      similarity: matchResult.similarity,
    });
  } catch (err: any) {
    console.error("[LoginFaceAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses login Face ID." },
      { status: 500 }
    );
  }
}
