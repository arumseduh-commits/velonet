import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const dbPresets = await prisma.locationPreset.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: dbPresets,
    });
  } catch (error: any) {
    console.error("GET /api/location-presets error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data preset lokasi" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, latitude, longitude, radiusMeter } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "Nama tempat, latitude, dan longitude wajib diisi." },
        { status: 400 }
      );
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const radNum = radiusMeter ? parseFloat(radiusMeter) : 50;

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { success: false, error: "Koordinat latitude atau longitude tidak valid." },
        { status: 400 }
      );
    }

    const preset = await prisma.locationPreset.upsert({
      where: { name },
      create: {
        name,
        latitude: latNum,
        longitude: lngNum,
        radiusMeter: radNum,
      },
      update: {
        latitude: latNum,
        longitude: lngNum,
        radiusMeter: radNum,
      },
    });

    return NextResponse.json({
      success: true,
      data: preset,
    });
  } catch (error: any) {
    console.error("POST /api/location-presets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan preset lokasi." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID preset lokasi wajib disertakan." },
        { status: 400 }
      );
    }

    await prisma.locationPreset.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Template preset lokasi berhasil dihapus.",
    });
  } catch (error: any) {
    console.error("DELETE /api/location-presets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus preset lokasi." },
      { status: 500 }
    );
  }
}
