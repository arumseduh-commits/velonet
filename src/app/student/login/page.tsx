"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquareCode,
  ArrowRight,
  RefreshCw,
  Key,
  Sparkles,
  SwitchCamera,
  ScanFace,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceWithDescriptor,
  validateFaceInGuide,
  FaceValidationResult,
} from "@/lib/client-face-api";

function StudentLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useDialog();

  // State untuk Tab: "FACE_ID" | "WA" | "PASSWORD"
  const [loginMethod, setLoginMethod] = useState<"FACE_ID" | "WA" | "PASSWORD">("FACE_ID");

  // State Face ID
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelsReady, setModelsReady] = useState(false);
  const [liveValidation, setLiveValidation] = useState<FaceValidationResult | null>(null);
  const [isLoggingInFace, setIsLoggingInFace] = useState(false);

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

  // 1. Initialize Encrypted WA Login Payload
  const initWaPayload = async () => {
    if (payloadId) return;
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

  // 2. Camera Controls for Face ID
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      await loadFaceApiModels();
      setModelsReady(true);

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setFacingMode(mode);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error("Gagal mengakses kamera. Pastikan izin kamera aktif pada browser Anda.");
      setCameraActive(false);
    }
  }, [facingMode, toast]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLiveValidation(null);
  }, []);

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    startCamera(nextMode);
  };

  // Switch tabs & lifecycle
  useEffect(() => {
    if (loginMethod === "FACE_ID") {
      startCamera();
    } else {
      stopCamera();
    }

    if (loginMethod === "WA") {
      initWaPayload();
    }

    return () => {
      stopCamera();
    };
  }, [loginMethod]);

  // 3. Live Face Tracking Loop for Face ID
  useEffect(() => {
    if (loginMethod !== "FACE_ID" || !cameraActive || !modelsReady) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      if (isLoggingInFace || !videoRef.current || videoRef.current.paused) return;

      try {
        const detection = await detectFaceWithDescriptor(videoRef.current);
        if (!detection || !isMounted) {
          setLiveValidation(null);
          return;
        }

        const valResult = validateFaceInGuide(videoRef.current, detection, guideRef.current, facingMode);
        if (isMounted) {
          setLiveValidation(valResult);
        }
      } catch (err) {
        // continue loop
      }
    }, 400);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loginMethod, cameraActive, modelsReady, isLoggingInFace, facingMode]);

  // 4. Perform Face ID Login
  const handleFaceLogin = async () => {
    if (!videoRef.current || videoRef.current.paused) {
      toast.warning("Kamera belum aktif. Silakan aktifkan kamera terlebih dahulu.");
      return;
    }

    setIsLoggingInFace(true);

    try {
      // 1. Detect Face descriptor
      const detection = await detectFaceWithDescriptor(videoRef.current);

      if (!detection) {
        toast.warning("Wajah tidak terdeteksi. Posisikan wajah Anda tepat di dalam lingkaran.");
        setIsLoggingInFace(false);
        return;
      }

      // 2. Guide Validation
      const validation = validateFaceInGuide(videoRef.current, detection, guideRef.current, facingMode);
      if (!validation.isValid) {
        toast.warning(validation.message);
        setIsLoggingInFace(false);
        return;
      }

      // 3. Send Biometric Vector to Login API
      const res = await fetch("/api/student/auth/login-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: detection.descriptor,
        }),
      });

      const json = await res.json();

      if (json.success) {
        stopCamera();
        toast.success(`Selamat datang, ${json.student?.name || "Siswa"}! Mengalihkan ke dashboard... 🎉`);
        setTimeout(() => {
          router.replace(json.redirectUrl || "/student");
        }, 800);
      } else {
        toast.error(json.error || "Wajah tidak dikenali. Silakan coba lagi atau gunakan WhatsApp.");
        setIsLoggingInFace(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses login Face ID.");
      setIsLoggingInFace(false);
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
    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_or_expired_link") {
      toast.error("Link login WhatsApp sudah kedaluwarsa atau tidak valid.");
    } else if (errorParam === "missing_token") {
      toast.error("Token verifikasi tidak ditemukan.");
    }
  }, [searchParams, toast]);

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
        body: JSON.stringify({ phoneNumber, password }),
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

  // Dynamic guide color calculation
  const isGuideValid = liveValidation?.isValid || false;
  const guideCode = liveValidation?.code;

  let guideBorderColor = "border-blue-500/60 shadow-[0_0_30px_rgba(59,130,246,0.25)]";
  let guideBadgeColor = "bg-slate-900/80 border-slate-700 text-slate-300";
  let guideBadgeText = "Arahkan wajah ke dalam lingkaran";

  if (isGuideValid) {
    guideBorderColor = "border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.45)] ring-4 ring-emerald-500/30";
    guideBadgeColor = "bg-emerald-950/80 border-emerald-500/50 text-emerald-300";
    guideBadgeText = "Wajah Pas di Lingkaran • Siap Masuk ✅";
  } else if (guideCode === "OUTSIDE_CIRCLE") {
    guideBorderColor = "border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.45)] ring-4 ring-rose-500/30";
    guideBadgeColor = "bg-rose-950/80 border-rose-500/50 text-rose-300";
    guideBadgeText = "Wajah di luar lingkaran! Geser ke tengah ⚠️";
  } else if (guideCode === "TOO_FAR") {
    guideBorderColor = "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.35)]";
    guideBadgeColor = "bg-amber-950/80 border-amber-500/50 text-amber-300";
    guideBadgeText = "Mendekatlah sedikit ke kamera ⚠️";
  } else if (guideCode === "TOO_CLOSE") {
    guideBorderColor = "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.35)]";
    guideBadgeColor = "bg-amber-950/80 border-amber-500/50 text-amber-300";
    guideBadgeText = "Terlalu dekat! Mundurlah sedikit ⚠️";
  } else if (guideCode === "TILTED") {
    guideBorderColor = "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.35)]";
    guideBadgeColor = "bg-amber-950/80 border-amber-500/50 text-amber-300";
    guideBadgeText = "Tegakkan posisi kepala Anda ⚠️";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Overlay */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative z-10 space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 mb-1">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Portal Siswa</h1>
          <p className="text-xs text-slate-400">Pilih metode masuk ke akun VeloNet Anda</p>
        </div>

        {/* 3-Tab Toggle: FACE_ID | WA | PASSWORD */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setLoginMethod("FACE_ID")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMethod === "FACE_ID"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ScanFace className="w-4 h-4" />
            <span>Face ID</span>
          </button>

          <button
            type="button"
            onClick={() => setLoginMethod("WA")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMethod === "WA"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setLoginMethod("PASSWORD")}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMethod === "PASSWORD"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Password</span>
          </button>
        </div>

        {/* 1. TAB: FACE ID LOGIN */}
        {loginMethod === "FACE_ID" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Camera Viewport Container */}
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {/* Oval Face Scanning Guide Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  ref={guideRef}
                  className={`w-44 h-56 rounded-[80px] border-2 transition-all duration-300 flex items-center justify-center relative ${guideBorderColor}`}
                >
                  <div className="absolute inset-1.5 border border-white/20 rounded-[74px]" />

                  {isLoggingInFace && (
                    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs rounded-[78px] flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                      <span className="text-[11px] font-bold text-white bg-slate-900/90 px-3 py-1 rounded-full border border-emerald-500/40">
                        Memverifikasi AI...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Camera Controls */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700/70 shadow-lg backdrop-blur-md transition-all cursor-pointer"
                  title="Ganti Kamera"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom Live Hint Overlay */}
              <div className="absolute bottom-2 inset-x-2 z-20 pointer-events-none flex justify-center">
                <div className={`px-3 py-1 rounded-xl border text-[11px] font-bold shadow-lg backdrop-blur-md transition-all ${guideBadgeColor}`}>
                  <span>{guideBadgeText}</span>
                </div>
              </div>
            </div>

            {/* Scan Action Button */}
            <button
              type="button"
              onClick={handleFaceLogin}
              disabled={isLoggingInFace || !cameraActive}
              className={`w-full py-3.5 px-5 rounded-2xl text-white font-bold text-xs sm:text-sm tracking-wide shadow-xl border transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                isGuideValid
                  ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30 border-emerald-400/40 ring-2 ring-emerald-500/30"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
              }`}
            >
              {isLoggingInFace ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>MEMVERIFIKASI WAJAH AI...</span>
                </>
              ) : (
                <>
                  <ScanFace className="w-4 h-4" />
                  <span>PINDAI WAJAH & MASUK SEKARANG</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Pastikan pencahayaan cukup dan wajah Anda sudah terdaftar di profil VeloNet.
            </p>
          </div>
        )}

        {/* 2. TAB: WHATSAPP LOGIN */}
        {loginMethod === "WA" && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 space-y-4 shadow-lg animate-in fade-in duration-200">
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

        {/* 3. TAB: PASSWORD LOGIN */}
        {loginMethod === "PASSWORD" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium ml-1">Nomor WhatsApp</label>
              <input
                type="text"
                placeholder="Contoh: 08123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium ml-1">Password / PIN</label>
              <input
                type="password"
                placeholder="Masukkan kata sandi Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loadingPassword}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
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
            <p className="text-center text-[11px] text-slate-500 pt-1">
              Lupa password? Silakan gunakan opsi Face ID atau WhatsApp.
            </p>
          </form>
        )}

        {/* Divider & Registration Section */}
        <div className="pt-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Atau</span>
            </div>
          </div>

          <div className="mt-5 text-center space-y-2.5">
            <p className="text-xs text-slate-400">Belum terdaftar sebagai anggota VeloNet?</p>
            <button
              onClick={handleRegisterClick}
              disabled={loadingRegister}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {loadingRegister ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquareCode className="w-4 h-4" />
              )}
              <span>DAFTAR ANGGOTA BARU (VIA WHATSAPP)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <StudentLoginContent />
    </Suspense>
  );
}
