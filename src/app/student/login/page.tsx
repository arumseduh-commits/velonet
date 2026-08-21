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
  X,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
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

  // State untuk Tab Login: Default adalah "WA"
  const [loginMethod, setLoginMethod] = useState<"WA" | "FACE_ID" | "PASSWORD">("WA");

  // State Face ID Full Screen Modal
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
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

  useEffect(() => {
    if (loginMethod === "WA") {
      initWaPayload();
    }
  }, [loginMethod]);

  // 2. Camera Controls for Face ID Full Screen Modal
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      setCameraLoading(true);
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
    } finally {
      setCameraLoading(false);
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

  // Open & Close Fullscreen Face ID Scanner
  const handleOpenFaceModal = () => {
    setIsFaceModalOpen(true);
    startCamera("user");
  };

  const handleCloseFaceModal = () => {
    stopCamera();
    setIsFaceModalOpen(false);
    setIsLoggingInFace(false);
  };

  // Clean up camera when unmounting or closing modal
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // 3. Live Face Tracking Loop in Full Screen Modal
  useEffect(() => {
    if (!isFaceModalOpen || !cameraActive || !modelsReady) return;

    let isMounted = true;
    let isBusy = false;

    const interval = setInterval(async () => {
      if (isBusy || isLoggingInFace || !videoRef.current || videoRef.current.paused || videoRef.current.videoWidth === 0) return;
      isBusy = true;
      try {
        const detection = await detectFaceWithDescriptor(videoRef.current);
        if (!isMounted) return;

        if (!detection) {
          setLiveValidation(null);
        } else {
          const valResult = validateFaceInGuide(videoRef.current, detection, guideRef.current, facingMode);
          setLiveValidation(valResult);
        }
      } catch (err) {
        // continue loop
      } finally {
        isBusy = false;
      }
    }, 300);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isFaceModalOpen, cameraActive, modelsReady, isLoggingInFace, facingMode]);

  // 4. Perform Face ID Login
  const handleFaceLogin = async () => {
    if (!videoRef.current || videoRef.current.paused) {
      toast.warning("Kamera belum aktif. Silakan tunggu sebentar.");
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
        setIsFaceModalOpen(false);
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

  let guideBorderColor = "border-blue-400/80 shadow-[0_0_35px_rgba(59,130,246,0.35)]";
  let guideBadgeColor = "bg-slate-900/90 border-slate-700 text-slate-300";
  let guideBadgeText = "Arahkan wajah ke dalam lingkaran";

  if (isGuideValid) {
    guideBorderColor = "border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.6)] ring-4 ring-emerald-500/40";
    guideBadgeColor = "bg-emerald-950/90 border-emerald-500/60 text-emerald-300";
    guideBadgeText = "Wajah Pas di Lingkaran • Siap Masuk ✅";
  } else if (guideCode === "OUTSIDE_CIRCLE") {
    guideBorderColor = "border-rose-500 shadow-[0_0_45px_rgba(244,63,94,0.55)] ring-4 ring-rose-500/30";
    guideBadgeColor = "bg-rose-950/90 border-rose-500/60 text-rose-300";
    guideBadgeText = "Wajah di luar lingkaran! Geser ke tengah ⚠️";
  } else if (guideCode === "TOO_FAR") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.45)]";
    guideBadgeColor = "bg-amber-950/90 border-amber-500/60 text-amber-300";
    guideBadgeText = "Mendekatlah sedikit ke layar ⚠️";
  } else if (guideCode === "TOO_CLOSE") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.45)]";
    guideBadgeColor = "bg-amber-950/90 border-amber-500/60 text-amber-300";
    guideBadgeText = "Terlalu dekat! Mundurlah sedikit ⚠️";
  } else if (guideCode === "TILTED") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.45)]";
    guideBadgeColor = "bg-amber-950/90 border-amber-500/60 text-amber-300";
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

        {/* 3-Tab Toggle: WA (Default) | FACE_ID | PASSWORD */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
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

        {/* 1. TAB: WHATSAPP LOGIN (DEFAULT) */}
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

        {/* 2. TAB: FACE ID LOGIN (LAUNCHER CARD) */}
        {loginMethod === "FACE_ID" && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 space-y-4 shadow-lg animate-in fade-in duration-200 text-center">
            <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
              <ScanFace className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Masuk Instan dengan Face ID AI
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Pindai biometrik wajah Anda dalam mode Full Screen tanpa perlu password atau kode OTP.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenFaceModal}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-emerald-600/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>BUKA KAMERA PINDAI WAJAH (FULL SCREEN)</span>
            </button>

            <p className="text-[11px] text-slate-500">
              💡 Pastikan wajah Anda sudah pernah direkam di profil VeloNet.
            </p>
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
              Lupa password? Silakan gunakan opsi WhatsApp atau Face ID.
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

      {/* ========================================================================= */}
      {/* FULL SCREEN IMMERSIVE FACE ID SCANNER MODAL                                */}
      {/* ========================================================================= */}
      {isFaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 select-none">
          {/* Fullscreen Video Stream */}
          <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover transform ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {/* Dark Mask Vignette Outside Oval Guide */}
            <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/80 pointer-events-none" />

            {/* Large Oval Biometric Guide Frame */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                ref={guideRef}
                className={`w-60 h-80 sm:w-72 sm:h-96 rounded-[110px] border-3 transition-all duration-300 flex items-center justify-center relative ${guideBorderColor}`}
              >
                {/* Inner Decorative Guides */}
                <div className="absolute inset-2 border border-white/20 rounded-[102px]" />

                {/* Animated Scanning Beam when Valid */}
                {isGuideValid && !isLoggingInFace && (
                  <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent animate-pulse shadow-[0_0_15px_#10b981]" />
                )}

                {/* Loading Overlay when Submitting */}
                {isLoggingInFace && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-[107px] flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                    <span className="text-xs font-bold text-white bg-slate-900/90 px-4 py-1.5 rounded-full border border-emerald-500/50 shadow-lg">
                      Memverifikasi Biometrik AI...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Floating Navigation Bar */}
          <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <button
              type="button"
              onClick={handleCloseFaceModal}
              className="px-3.5 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 text-xs font-bold shadow-xl backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Batal</span>
            </button>

            <div className="px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 backdrop-blur-md shadow-lg">
              <ScanFace className="w-3.5 h-3.5" />
              <span>VeloNet Face ID</span>
            </div>

            <button
              type="button"
              onClick={toggleCameraFacing}
              className="p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-xl backdrop-blur-md transition-all cursor-pointer"
              title="Ganti Kamera Depan / Belakang"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Floating Action Dock */}
          <div className="relative z-20 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center gap-3">
            {/* Live Guide Status Badge */}
            <div className={`px-4 py-2 rounded-2xl border text-xs font-bold shadow-2xl backdrop-blur-md transition-all flex items-center gap-2 ${guideBadgeColor}`}>
              {isGuideValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{guideBadgeText}</span>
            </div>

            {/* Big Action Button */}
            <button
              type="button"
              onClick={handleFaceLogin}
              disabled={isLoggingInFace || !cameraActive}
              className={`w-full max-w-sm py-4 px-6 rounded-2xl text-white font-extrabold text-sm sm:text-base tracking-wide shadow-2xl border transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 ${
                isGuideValid
                  ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40 border-emerald-400/50 ring-4 ring-emerald-500/30 scale-[1.02]"
                  : "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300 backdrop-blur-md"
              }`}
            >
              {isLoggingInFace ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>MEMVERIFIKASI WAJAH...</span>
                </>
              ) : (
                <>
                  <ScanFace className="w-5 h-5" />
                  <span>PINDAI WAJAH & MASUK SEKARANG</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
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
