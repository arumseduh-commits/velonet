import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/bot-state-machine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, items } = body;

    let parsedList: { phoneNumber: string; name?: string }[] = [];

    if (Array.isArray(items) && items.length > 0) {
      parsedList = items;
    } else if (typeof rawText === "string" && rawText.trim().length > 0) {
      const lines = rawText.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Try comma, tab, dash, or colon split
        let phone = "";
        let name = "";

        if (trimmed.includes(",")) {
          const parts = trimmed.split(",");
          phone = parts[0].trim();
          name = parts.slice(1).join(",").trim();
        } else if (trimmed.includes("\t")) {
          const parts = trimmed.split("\t");
          phone = parts[0].trim();
          name = parts.slice(1).join(" ").trim();
        } else if (trimmed.includes("-")) {
          const parts = trimmed.split("-");
          phone = parts[0].trim();
          name = parts.slice(1).join("-").trim();
        } else if (trimmed.includes(":")) {
          const parts = trimmed.split(":");
          phone = parts[0].trim();
          name = parts.slice(1).join(":").trim();
        } else {
          phone = trimmed;
        }

        const cleanDigits = phone.replace(/\D/g, "");
        if (cleanDigits.length >= 8) {
          parsedList.push({
            phoneNumber: phone,
            name: name || undefined,
          });
        }
      }
    }

    if (parsedList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada nomor HP valid yang ditemukan." },
        { status: 400 }
      );
    }

    let successCount = 0;
    const importedResults = [];

    for (const item of parsedList) {
      const cleanNum = normalizePhoneNumber(item.phoneNumber);
      if (!cleanNum || cleanNum.length < 8) continue;

      const existing = await prisma.user.findUnique({
        where: { phoneNumber: cleanNum },
      });

      if (existing) {
        // Don't overwrite if already completed
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || item.name || null,
          },
        });
        importedResults.push(updated);
      } else {
        const created = await prisma.user.create({
          data: {
            phoneNumber: cleanNum,
            name: item.name || null,
            status: "NOT_STARTED",
          },
        });
        importedResults.push(created);
      }
      successCount++;
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      data: importedResults,
      message: `Berhasil mengimpor ${successCount} nomor HP peserta.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengimpor data peserta." },
      { status: 500 }
    );
  }
}
