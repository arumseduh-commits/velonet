import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
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
      },
    });

    const parsedUsers = users.map((u) => {
      let descriptorArray: number[] = [];
      try {
        if (u.faceDescriptor) {
          descriptorArray = JSON.parse(u.faceDescriptor);
        }
      } catch (e) {}

      return {
        id: u.id,
        name: u.name || "Peserta",
        studentClass: u.studentClass || "-",
        phoneNumber: u.phoneNumber,
        gender: u.gender,
        facePhoto: u.facePhoto,
        descriptor: descriptorArray,
      };
    });

    return NextResponse.json({
      success: true,
      data: parsedUsers,
    });
  } catch (err: any) {
    console.error("[FaceDescriptorsAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil data biometrik wajah." },
      { status: 500 }
    );
  }
}
