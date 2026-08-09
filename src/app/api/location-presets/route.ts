import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PRESETS = [
  {
    id: "default-caprice",
    name: "Ruang Caprice",
    latitude: -7.9666,
    longitude: 112.6326,
    radiusMeter: 15,
    isDefault: true,
  },
  {
    id: "default-bi",
    name: "Ruang BI",
    latitude: -7.9785,
    longitude: 112.6315,
    radiusMeter: 15,
    isDefault: true,
  },
];

export async function GET() {
  try {
    const dbPresets = await prisma.locationPreset.findMany({
      orderBy: { name: "asc" },
    });

    // Merge default presets with database custom presets
    const allPresets = [
      ...DEFAULT_PRESETS,
      ...dbPresets.map((p) => ({ ...p, isDefault: false })),
    ];

    return NextResponse.json({
      success: true,
      data: allPresets,
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
    const radNum = radiusMeter ? parseFloat(radiusMeter) : 150;

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
