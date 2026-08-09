import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get("format") || "csv"; // 'csv' or 'excel'

    const participants = await prisma.participant.findMany({
      orderBy: { createdAt: "desc" },
    });

    const exportData = participants.map((p: any, index: number) => ({
      No: index + 1,
      "No. WhatsApp": p.phoneNumber,
      Nama: p.name || "-",
      Kelas: p.studentClass || "-",
      "Alasan / Motivasi": p.motivation || "-",
      Hobi: p.hobby || "-",
      Status: p.status,
      "Dikecualikan (Excluded)": p.isExcluded ? "Ya" : "Tidak",
      "Sudah Di-Kick": p.isKickedFromGrp ? "Ya" : "Tidak",
      "Pesan Terakhir Dikirim": p.lastSentAt
        ? new Date(p.lastSentAt).toLocaleString("id-ID")
        : "-",
      "Tanggal Terdaftar": new Date(p.createdAt).toLocaleString("id-ID"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Peserta Velocity");

    if (format === "excel" || format === "xlsx") {
      const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Velocity_Participants_${Date.now()}.xlsx"`,
        },
      });
    }

    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Velocity_Participants_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to export data." },
      { status: 500 }
    );
  }
}
