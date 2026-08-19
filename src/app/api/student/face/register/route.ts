import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { faceDescriptor, photoBase64 } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        { success: false, error: "Vektor biometrik wajah tidak valid (harus 128 dimensi)." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: student.id },
      data: {
        faceDescriptor: JSON.stringify(faceDescriptor),
        facePhoto: typeof photoBase64 === "string" ? photoBase64 : null,
        faceRegisteredAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data wajah Anda berhasil disimpan dan didaftarkan untuk absensi!",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        faceRegisteredAt: updatedUser.faceRegisteredAt,
      },
    });
  } catch (err: any) {
    console.error("[StudentFaceRegisterAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menyimpan data biometrik wajah." },
      { status: 500 }
    );
  }
}
