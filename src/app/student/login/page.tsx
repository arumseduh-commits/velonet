"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquareCode, ArrowRight, RefreshCw, Key, ShieldCheck, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useDialog();

  // State untuk Tab
  const [loginMethod, setLoginMethod] = useState<"WA" | "PASSWORD">("WA");

  // State WA
  const [payloadId, setPayloadId] = useState<string>("");
  const [waLink, setWaLink] = useState<string>("");
  const [commandText, setCommandText] = useState<string>("");
  const [loadingWa, setLoadingWa] = useState(false);
  const [verifyingWa, setVerifyingWa] = useState(false);

  // State Password
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  // State Register
  const [loadingRegister, setLoadingRegister] = useState(false);

  // Initialize Encrypted WA Login Payload
  const initWaPayload = async () => {
    if (payloadId) return; // Jangan request ulang jika sudah ada
    setLoadingWa(true);
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
      console.error("Failed to create WA payload", err);
    } finally {
      setLoadingWa(false);
    }
  };

  const handleRegisterClick = async () => {
    setLoadingRegister(true);
    try {
      const res = await fetch("/api/student/auth/create-register-payload");
      const json = await res.json();
      if (json.success && json.waLink) {
        window.open(json.waLink, "_blank");
      } else {
        toast.error("Gagal membuat sesi pendaftaran.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoadingRegister(false);
    }
  };

  useEffect(() => {
    if (loginMethod === "WA") {
      initWaPayload();
    }
  }, [loginMethod]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_or_expired_link") {
      toast.error("Link login WhatsApp sudah kedaluwarsa atau tidak valid.");
    } else if (errorParam === "missing_token") {
      toast.error("Token verifikasi tidak ditemukan.");
    }
  }, [searchParams]);

  // Live Auto-Poll Payload Status untuk WA
  useEffect(() => {
    if (loginMethod !== "WA" || !payloadId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/auth/check-temp-payload?payloadId=${payloadId}`);
        const json = await res.json();
        if (json.success && json.verified && json.redirectUrl) {
          setVerifyingWa(true);
          toast.success("Verifikasi WhatsApp Berhasil! Mengalihkan...");
          clearInterval(interval);
          router.push(json.redirectUrl);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [payloadId, loginMethod, router, toast]);

  // Handler Login Password
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !password) return toast.error("Nomor HP dan Password wajib diisi.");
    
    setLoadingPassword(true);
    try {
      const res = await fetch("/api/student/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password })
      });
      const json = await res.json();
      
      if (json.success) {
        toast.success("Login berhasil! Mengalihkan...");
        router.push(json.redirectUrl);
      } else {
        toast.error(json.error || "Login gagal.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoadingPassword(false);
    }
  };

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
            Portal Siswa
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pilih metode masuk ke akun VeloNet Anda
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
          <button 
            onClick={() => setLoginMethod("PASSWORD")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${loginMethod === "PASSWORD" ? "bg-slate-800 text-white shadow border border-slate-700" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Key className="w-4 h-4" />
            <span>Password</span>
          </button>
          <button 
            onClick={() => setLoginMethod("WA")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${loginMethod === "WA" ? "bg-emerald-900/50 text-emerald-400 shadow border border-emerald-800/50" : "text-slate-500 hover:text-slate-300"}`}
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* FORM PASSWORD */}
        {loginMethod === "PASSWORD" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium ml-1">Nomor WhatsApp</label>
              <input 
                type="text" 
                placeholder="Contoh: 08123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium ml-1">Password / PIN</label>
              <input 
                type="password" 
                placeholder="Masukkan kata sandi Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loadingPassword}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loadingPassword ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <span>MASUK</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-500 pt-2">
              Lupa password? Silakan gunakan opsi WhatsApp atau hubungi Admin.
            </p>
          </form>
        )}

        {/* FORM WHATSAPP */}
        {loginMethod === "WA" && (
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

            {loadingWa ? (
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

            {/* Live Status Detector */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
              <div className="relative shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-400 block" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute inset-0 opacity-75" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">
                  {verifyingWa ? "Verifikasi Sukses! Mengalihkan..." : "Menunggu pengiriman pesan WhatsApp Anda..."}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Halaman ini akan otomatis masuk begitu pesan dikirimkan di WhatsApp.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Divider & Registration Section */}
        <div className="pt-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">
                Atau
              </span>
            </div>
          </div>
          
          <div className="mt-6 text-center space-y-3">
            <p className="text-xs text-slate-400">
              Belum terdaftar sebagai anggota VeloNet?
            </p>
            <button
              onClick={handleRegisterClick}
              disabled={loadingRegister}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all disabled:opacity-50"
            >
              {loadingRegister ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquareCode className="w-4 h-4" />
              )}
              <span>DAFTAR VIA WHATSAPP</span>
            </button>
          </div>
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
