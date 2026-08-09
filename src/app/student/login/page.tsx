"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquareCode, ArrowRight, RefreshCw, ShieldCheck, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useDialog();

  const [payloadId, setPayloadId] = useState<string>("");
  const [waLink, setWaLink] = useState<string>("");
  const [commandText, setCommandText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // Initialize Encrypted WA Login Payload
  const initLoginPayload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/create-login-payload");
      const json = await res.json();
      if (json.success) {
        setPayloadId(json.payloadId);
        setWaLink(json.waLink);
        setCommandText(json.commandText);
      } else {
        toast.error("Gagal membuat sesi login WhatsApp.");
      }
    } catch (err) {
      console.error("Failed to create login payload:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initLoginPayload();

    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_or_expired_link") {
      toast.error("Link login WhatsApp sudah kedaluwarsa atau tidak valid.");
    } else if (errorParam === "missing_token") {
      toast.error("Token verifikasi tidak ditemukan.");
    }
  }, [searchParams]);

  // Live Auto-Poll Payload Status (Checks every 2 seconds)
  useEffect(() => {
    if (!payloadId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/auth/check-temp-payload?payloadId=${payloadId}`);
        const json = await res.json();

        if (json.success && json.verified && json.redirectUrl) {
          setVerifying(true);
          toast.success("Verifikasi WhatsApp Berhasil! Mengalihkan...");
          clearInterval(interval);
          router.push(json.redirectUrl);
        }
      } catch (e) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [payloadId, router, toast]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Overlay */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 mb-1">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portal Siswa Velocity
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Masuk instan tanpa ketik nomor HP & tanpa ketik OTP manual
          </p>
        </div>

        {/* Instant WhatsApp Login Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 space-y-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <MessageSquareCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                ⚡ LOGIN INSTAN VIA WHATSAPP (1-KLIK)
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tekan tombol di bawah untuk membuka WA & mengirim pesan verifikasi otomatis.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Membuat sesi login WhatsApp aman...</span>
            </div>
          ) : (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <span>📱 MASUK SEKARANG VIA WHATSAPP</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Live Status Detector */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
          <div className="relative shrink-0">
            <span className="w-3 h-3 rounded-full bg-emerald-400 block" />
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute inset-0 opacity-75" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-slate-200">
              {verifying ? "Verifikasi Sukses! Mengalihkan..." : "Menunggu pengiriman pesan WhatsApp Anda..."}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Halaman ini akan otomatis masuk begitu pesan dikirimkan di WhatsApp.
            </p>
          </div>
        </div>

        {/* Instructions Box */}
        <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
          <p className="font-semibold text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bagaimana Cara Kerjanya?</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
            <li>Klik tombol **"Masuk Sekarang via WhatsApp"** di atas.</li>
            <li>Aplikasi WhatsApp Anda akan terbuka dengan teks pesan terisi.</li>
            <li>Tekan **Kirim (Send)** di WhatsApp.</li>
            <li>Bot WA akan membalas dengan link atau web ini otomatis beralih!</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="pt-2 text-center text-[11px] text-slate-500">
          <span>Khusus Anggota Komunitas Velocity • VeloNet Engine</span>
        </div>
      </div>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    }>
      <StudentLoginContent />
    </Suspense>
  );
}
