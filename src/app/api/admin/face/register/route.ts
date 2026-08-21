import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestFaceMatch } from "@/lib/face-recognition";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, faceDescriptor, photoBase64 } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID diperlukan." },
        { status: 400 }
      );
    }

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        { success: false, error: "Vektor biometrik wajah tidak valid (harus 128 dimensi)." },
        { status: 400 }
      );
    }

    // 1. Biometric Uniqueness Check: Ensure this face is NOT already registered by another account
    const existingUsersWithFace = await prisma.user.findMany({
      where: {
        id: { not: userId },
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
      },
    });

    if (existingUsersWithFace.length > 0) {
      const matchResult = findBestFaceMatch(faceDescriptor, existingUsersWithFace, 0.45);
      if (matchResult.isMatch && matchResult.matchedUser) {
        const ownerName = matchResult.matchedUser.name || "Peserta Lain";
        const ownerClass = matchResult.matchedUser.studentClass || "-";
        return NextResponse.json(
          {
            success: false,
            error: `❌ Perekaman Wajah Ditolak: Wajah ini sudah terdaftar pada akun "${ownerName}" (${ownerClass}) dengan kecocokan ${matchResult.similarity}%.`,
          },
          { status: 409 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        faceDescriptor: JSON.stringify(faceDescriptor),
        facePhoto: typeof photoBase64 === "string" ? photoBase64 : null,
        faceRegisteredAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Data wajah peserta "${updatedUser.name || updatedUser.phoneNumber}" berhasil didaftarkan!`,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        faceRegisteredAt: updatedUser.faceRegisteredAt,
      },
    });
  } catch (err: any) {
    console.error("[AdminFaceRegisterAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menyimpan data biometrik wajah peserta." },
      { status: 500 }
    );
  }
}
