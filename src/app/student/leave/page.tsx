"use client";

export const dynamic = "force-dynamic";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, ArrowRight, Sparkles } from "lucide-react";

export default function StudentLeavePage() {
  const router = useRouter();

  useEffect(() => {
    // Auto redirect to new Face Recognition attendance page
    router.replace("/student/attendance");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <Camera className="w-10 h-10 animate-pulse" />
      </div>
      <div className="space-y-1 max-w-md">
        <h1 className="text-xl font-bold text-white">Dialihkan ke Absensi Wajah</h1>
        <p className="text-xs text-slate-400">
          Fitur surat izin telah digantikan dengan sistem Absensi Face Recognition & Smart Lokasi.
        </p>
      </div>

      <Link
        href="/student/attendance"
        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
      >
        <span>Buka Halaman Absensi Wajah</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
