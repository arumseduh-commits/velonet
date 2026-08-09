"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Phone, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck, MessageSquareCode, Sparkles } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useDialog();

  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_or_expired_link") {
      toast.error("Link login WhatsApp sudah kedaluwarsa atau tidak valid. Silakan minta OTP baru.");
    } else if (errorParam === "missing_token") {
      toast.error("Token verifikasi tidak ditemukan.");
    }
  }, [searchParams, toast]);

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "OTP" && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Handle Request OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber.trim()) {
      toast.warning("Masukkan nomor WhatsApp Anda.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Kode OTP 6-Digit berhasil dikirim ke WhatsApp Anda!");
        setStep("OTP");
        setResendTimer(60);
        setCanResend(false);
      } else {
        toast.error(json.error || "Gagal mengirim OTP.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      toast.warning("Masukkan 6-digit kode OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          otpCode: otpCode.trim(),
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Verifikasi berhasil! Mengalihkan ke Portal Siswa...");
        router.push("/student");
      } else {
        toast.error(json.error || "Kode OTP salah.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan verifikasi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Overlay */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Header Header Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 text-emerald-400 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portal Siswa Velocity
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Masuk praktis tanpa password menggunakan nomor WhatsApp Anda
          </p>
        </div>

        {step === "PHONE" ? (
          /* STEP 1: Phone Number Input Form */
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nomor WhatsApp Terdaftar</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Gunakan nomor WA yang Anda gunakan saat mendaftar ekskul Velocity.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirim OTP ke WhatsApp...</span>
                </>
              ) : (
                <>
                  <span>🚀 Kirim Kode OTP via WhatsApp</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span>Kode OTP telah dikirim via WhatsApp ke </span>
                <strong className="text-white font-mono">{phoneNumber}</strong>.
                <button
                  type="button"
                  onClick={() => setStep("PHONE")}
                  className="block mt-1 text-[11px] text-emerald-400 hover:underline font-semibold"
                >
                  (Ubah Nomor HP)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquareCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Masukkan 6-Digit Kode OTP</span>
                </span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="482910"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtpCode(val);
                  if (val.length === 6) {
                    // Auto submit on 6 digits
                    setTimeout(() => handleVerifyOtp(), 100);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verifikasi & Masuk Portal</span>
                </>
              )}
            </button>

            {/* Resend OTP Button */}
            <div className="text-center pt-2 border-t border-slate-800/80">
              {canResend ? (
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  className="text-xs font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kirim Ulang Kode OTP</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-mono">
                  Kirim ulang kode OTP dalam <strong>{resendTimer} detik</strong>
                </span>
              )}
            </div>
          </form>
        )}

        {/* Card Footer Info */}
        <div className="pt-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
          <span>Belum terdaftar di WhatsApp Velocity? </span>
          <br />
          <span className="text-slate-400">Hubungi Pembina atau daftarkan diri lewat Bot WA.</span>
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
