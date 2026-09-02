"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock, AlertTriangle, ShieldAlert, KeyRound, ArrowLeft, RefreshCw, Sparkles } from "lucide-react";

function ExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "expired";

  let badge = "Tautan Kedaluwarsa";
  let title = "Tautan Sudah Tidak Berlaku";
  let description =
    "Tautan verifikasi WhatsApp yang Anda buka sudah melewati batas waktu berlaku (10 menit) atau telah digunakan sebelumnya demi keamanan akun Anda.";
  let IconComponent = Clock;
  let iconBg = "bg-amber-50 border-amber-200 text-amber-600";

  if (reason === "already_used") {
    badge = "Tautan Sudah Digunakan";
    title = "Tautan Sudah Pernah Dibuka";
    description =
      "Tautan verifikasi WhatsApp ini hanya berlaku untuk 1 kali akses dan sudah berhasil digunakan sebelumnya. Untuk masuk kembali, silakan buat permintaan login baru.";
    IconComponent = KeyRound;
    iconBg = "bg-blue-50 border-blue-200 text-blue-600";
  } else if (reason === "expired") {
    badge = "Batas Waktu Habis";
    title = "Tautan Telah Kedaluwarsa";
    description =
      "Masa berlaku tautan login / pendaftaran WhatsApp (10 menit) telah berakhir. Silakan minta tautan baru melalui aplikasi.";
    IconComponent = Clock;
    iconBg = "bg-amber-50 border-amber-200 text-amber-600";
  } else if (reason === "account_disabled") {
    badge = "Akses Dibatasi";
    title = "Akun Tidak Aktif";
    description =
      "Nomor WhatsApp atau akun ini dinonaktifkan oleh administrator. Silakan hubungi admin komunitas Velocity jika Anda merasa ini adalah kekeliruan.";
    IconComponent = ShieldAlert;
    iconBg = "bg-rose-50 border-rose-200 text-rose-600";
  } else if (reason === "missing_token" || reason === "not_found") {
    badge = "Tautan Tidak Valid";
    title = "Tautan Tidak Ditemukan";
    description =
      "Kode token verifikasi tidak ditemukan atau format tautan tidak sesuai. Silakan akses kembali melalui portal utama.";
    IconComponent = AlertTriangle;
    iconBg = "bg-rose-50 border-rose-200 text-rose-600";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-600 selection:text-white">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
        {/* Animated Icon Glow */}
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center border shadow-md transition-all transform hover:scale-105 ${iconBg}`}>
            <IconComponent className="w-10 h-10" />
          </div>
        </div>

        {/* Badge & Title */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            {badge}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            {description}
          </p>
        </div>

        {/* Informative Step Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Bagaimana cara mendapatkan link baru?</span>
          </p>
          <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Buka halaman <strong>Login / Pendaftaran</strong> Portal Siswa.</li>
            <li>Klik tombol <strong>Login Instan via WhatsApp</strong> atau <strong>Daftar via WhatsApp</strong>.</li>
            <li>Kirim pesan WhatsApp otomatis ke Bot dan klik tautan baru yang dikirimkan.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/student/login"
            className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 btn-press transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>MINTA TAUTAN BARU</span>
          </Link>

          <Link
            href="/"
            className="py-3.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ke Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function StudentExpiredPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm font-medium">Memeriksa status tautan...</span>
        </div>
      }
    >
      <ExpiredContent />
    </Suspense>
  );
}
