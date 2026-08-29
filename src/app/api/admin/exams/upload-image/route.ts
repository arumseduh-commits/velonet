import { NextRequest, NextResponse } from "next/server";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Tidak ada file gambar yang diunggah." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "questions");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Determine extension, default to .webp
    const isWebP = file.type === "image/webp" || file.name.endsWith(".webp");
    const ext = isWebP ? ".webp" : path.extname(file.name) || ".webp";
    const filename = `question_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/questions/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error("[Upload Question Image API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengunggah gambar." },
      { status: 500 }
    );
  }
}
