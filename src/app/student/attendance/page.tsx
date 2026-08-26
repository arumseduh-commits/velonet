"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Navigation,
  SwitchCamera,
  ArrowLeft,
  User,
  X,
  Zap,
  ScanFace,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceWithDescriptor,
  captureFrameBase64,
  validateFaceInGuide,
  FaceValidationResult,
  DetectedFaceData,
} from "@/lib/client-face-api";

interface StudentProfile {
  id: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  gender: string;
  isFaceRegistered: boolean;
  facePhoto: string | null;
}

interface ActiveSession {
  id: string;
  title: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeter: number;
  startTime: string;
  endTime: string;
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const { toast } = useDialog();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  // GPS Coordinates State
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Camera & Face API State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelsReady, setModelsReady] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [liveValidation, setLiveValidation] = useState<FaceValidationResult | null>(null);

  // Recognition Result Modal Popup State
  const [lastCheckInResult, setLastCheckInResult] = useState<{
    status: "SUCCESS" | "ALREADY_CHECKED_IN" | "ACCOUNT_MISMATCH" | "UNKNOWN_FACE" | "OUT_OF_RADIUS" | "LOCATION_REQUIRED" | "NO_SESSION" | "ERROR";
    message: string;
    detectedName?: string;
    detectedClass?: string;
    loggedInName?: string;
    similarity?: number;
    distanceMeter?: number | null;
    sessionTitle?: string;
    locationName?: string;
    timeStr?: string;
  } | null>(null);

  // 1. Fetch Student Profile & Active Sessions
  const fetchInitialData = useCallback(async () => {
    try {
      const [meRes, locRes] = await Promise.all([
        fetch("/api/student/auth/me"),
        fetch("/api/attendance/active-locations"),
      ]);

      const meJson = await meRes.json();
      if (meJson.success && meJson.data?.student) {
        setStudent(meJson.data.student);
      } else {
        router.replace("/student/login");
        return;
      }

      const locJson = await locRes.json();
      if (locJson.success && locJson.data) {
        setActiveSessions(locJson.data);
      }
    } catch (err) {
      console.error("Failed to load attendance page data:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. Load Face API Models
  useEffect(() => {
    let isMounted = true;
    loadFaceApiModels().then((ready) => {
      if (isMounted) {
        setModelsReady(ready);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Acquire Real-time GPS Location
  const acquireGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung GPS.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.message || "Gagal mengambil lokasi GPS.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    acquireGps();
  }, [acquireGps]);

  // 4. Start & Stop Camera Stream
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setFacingMode(mode);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error(`Kamera tidak dapat diakses: ${err.message || "Periksa izin kamera browser."}`);
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
  }, []);

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    startCamera(nextMode);
  };

  // Auto-start camera when models and data are ready
  useEffect(() => {
    if (!loading && modelsReady && !cameraActive) {
      startCamera("user");
    }
  }, [loading, modelsReady, cameraActive, startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Hands-free Auto-Scan Refs
  const isAutoScanningRef = useRef(false);
  const autoScanCooldownUntilRef = useRef(0);

  // 4. Real-time live face tracking & Hands-Free Auto Check-in loop
  useEffect(() => {
    if (!cameraActive || !modelsReady) return;

    let isMounted = true;
    let isBusy = false;

    const interval = setInterval(async () => {
      if (
        isBusy ||
        submittingAttendance ||
        lastCheckInResult ||
        isAutoScanningRef.current ||
        Date.now() < autoScanCooldownUntilRef.current ||
        !videoRef.current ||
        videoRef.current.paused ||
        videoRef.current.videoWidth === 0
      )
        return;

      isBusy = true;
      try {
        const detection = await detectFaceWithDescriptor(videoRef.current);
        if (!isMounted) return;

        if (!detection) {
          setLiveValidation(null);
        } else {
          const validation = validateFaceInGuide(videoRef.current, detection, guideRef.current, facingMode);
          setLiveValidation(validation);

          // Hands-free instant auto check-in when face is properly centered in circle
          if (
            validation.isValid &&
            !submittingAttendance &&
            !lastCheckInResult &&
            !isAutoScanningRef.current
          ) {
            const requiresGps =
              activeSessions.length === 0 ||
              activeSessions.some((s) => s.latitude != null && s.longitude != null);

            // Auto-trigger if GPS is locked or not required
            if (!requiresGps || gpsLocation) {
              isAutoScanningRef.current = true;
              executeFaceCheckIn(detection);
            }
          }
        }
      } catch (err) {
        // ignore per-frame detection errors
      } finally {
        isBusy = false;
      }
    }, 280);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cameraActive, modelsReady, submittingAttendance, lastCheckInResult, facingMode, activeSessions, gpsLocation]);

  // 5. Handle Face Recognition Attendance Check-In (Auto-Scan & Manual Click)
  const executeFaceCheckIn = async (detectionParam?: DetectedFaceData) => {
    if (!videoRef.current || !cameraActive) {
      isAutoScanningRef.current = false;
      return;
    }

    if (!modelsReady) {
      isAutoScanningRef.current = false;
      return;
    }

    // Strict GPS Enforcement: Active sessions require valid GPS coordinate
    const requiresGps = activeSessions.length === 0 || activeSessions.some((s) => s.latitude != null && s.longitude != null);
    if (requiresGps && !gpsLocation) {
      if (gpsLoading) {
        toast.warning("Sedang mengunci titik lokasi GPS Anda, mohon tunggu sebentar...");
        isAutoScanningRef.current = false;
        return;
      }
      toast.error("Lokasi GPS wajib aktif untuk melakukan absensi. Silakan izinkan akses lokasi di browser HP Anda.");
      acquireGps();
      isAutoScanningRef.current = false;
      return;
    }

    setSubmittingAttendance(true);

    try {
      let detection = detectionParam;
      if (!detection) {
        const detected = await detectFaceWithDescriptor(videoRef.current);
        if (!detected) {
          toast.warning("Wajah tidak terdeteksi di kamera! Posisikan wajah Anda tepat di dalam lingkaran.");
          setSubmittingAttendance(false);
          isAutoScanningRef.current = false;
          autoScanCooldownUntilRef.current = Date.now() + 1500;
          return;
        }

        const validation = validateFaceInGuide(videoRef.current, detected, guideRef.current, facingMode);
        if (!validation.isValid) {
          toast.warning(validation.message);
          setSubmittingAttendance(false);
          isAutoScanningRef.current = false;
          autoScanCooldownUntilRef.current = Date.now() + 1500;
          return;
        }
        detection = detected;
      }

      const photoBase64 = captureFrameBase64(videoRef.current, detection.box);

      // Send to Backend Verifier
      const res = await fetch("/api/attendance/face-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: detection.descriptor,
          latitude: gpsLocation?.latitude,
          longitude: gpsLocation?.longitude,
          photoBase64,
        }),
      });

      const json = await res.json();

      if (json.code === "SUCCESS") {
        setLastCheckInResult({
          status: "SUCCESS",
          message: json.message || "Absensi berhasil dicatat!",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
          distanceMeter: json.distanceMeter,
          sessionTitle: json.sessionTitle,
          locationName: json.locationName,
          timeStr: json.checkInTime,
        });
      } else if (json.code === "ALREADY_CHECKED_IN") {
        setLastCheckInResult({
          status: "ALREADY_CHECKED_IN",
          message: json.message || "Anda sudah melakukan absensi untuk pertemuan kali ini.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
          distanceMeter: json.distanceMeter,
          sessionTitle: json.sessionTitle,
          locationName: json.locationName,
          timeStr: json.checkInTime,
        });
      } else if (json.code === "ACCOUNT_MISMATCH") {
        setLastCheckInResult({
          status: "ACCOUNT_MISMATCH",
          message: json.message || "Wajah di kamera tidak cocok dengan akun yang sedang login.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          loggedInName: json.loggedInName,
          similarity: json.similarity,
        });
      } else if (json.code === "LOCATION_REQUIRED") {
        setLastCheckInResult({
          status: "LOCATION_REQUIRED",
          message: json.message || "Lokasi GPS wajib diaktifkan untuk melakukan absensi pada sesi ini.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
          sessionTitle: json.sessionTitle,
          locationName: json.locationName,
        });
      } else if (json.code === "UNKNOWN_FACE") {
        setLastCheckInResult({
          status: "UNKNOWN_FACE",
          message: json.message || "Wajah tidak dikenali atau belum terdaftar di sistem Velocity.",
        });
      } else if (json.code === "OUT_OF_RADIUS") {
        setLastCheckInResult({
          status: "OUT_OF_RADIUS",
          message: json.message || "Lokasi Anda berada di luar radius toleransi sesi kumpul.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
          distanceMeter: json.distanceMeter,
          sessionTitle: json.sessionTitle,
          locationName: json.locationName,
        });
      } else {
        setLastCheckInResult({
          status: "ERROR",
          message: json.message || json.error || "Gagal memproses absensi wajah.",
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses absensi wajah.");
    } finally {
      setSubmittingAttendance(false);
      isAutoScanningRef.current = false;
      autoScanCooldownUntilRef.current = Date.now() + 2000;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-9 h-9 animate-spin text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Membuka Kamera Absensi Wajah...</span>
      </div>
    );
  }

  const isGuideValid = liveValidation?.isValid;
  const guideCode = liveValidation?.code;

  let guideBorderColor = "border-dashed border-slate-500/70 shadow-none";
  let guideBadgeColor = "bg-slate-900/85 text-white border-slate-700/80";
  let guideBadgeText = "Arahkan wajah Anda ke dalam lingkaran";

  if (submittingAttendance) {
    guideBorderColor = "border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.5)]";
    guideBadgeColor = "bg-emerald-950/90 text-emerald-300 border-emerald-500/40";
    guideBadgeText = "Memproses Verifikasi Wajah...";
  } else if (isGuideValid) {
    guideBorderColor = "border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.5)] bg-emerald-500/10";
    guideBadgeColor = "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20";
    guideBadgeText = "Posisi Wajah Sesuai (Siap Absen)";
  } else if (guideCode === "TOO_FAR") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)] bg-amber-500/5";
    guideBadgeColor = "bg-amber-950/90 text-amber-300 border-amber-500/40";
    guideBadgeText = "Dekatkan Wajah ke Kamera";
  } else if (guideCode === "TOO_CLOSE") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)] bg-amber-500/5";
    guideBadgeColor = "bg-amber-950/90 text-amber-300 border-amber-500/40";
    guideBadgeText = "Mundurkan Wajah Sedikit";
  } else if (guideCode === "TILTED") {
    guideBorderColor = "border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)] bg-amber-500/5";
    guideBadgeColor = "bg-amber-950/90 text-amber-300 border-amber-500/40";
    guideBadgeText = "Posisikan Wajah Tegak";
  } else if (guideCode === "OUTSIDE_CIRCLE") {
    guideBorderColor = "border-rose-400 shadow-[0_0_40px_rgba(244,63,94,0.4)] bg-rose-500/5";
    guideBadgeColor = "bg-rose-950/90 text-rose-300 border-rose-500/40";
    guideBadgeText = "Arahkan Wajah ke Tengah";
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white w-screen h-screen overflow-hidden select-none flex flex-col justify-between">
      {/* 1. FULL-BLEED BACKGROUND LIVE VIDEO */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${
          facingMode === "user" ? "transform -scale-x-100" : ""
        }`}
      />

      {/* Dark Gradient Overlays for Readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      {/* 2. TOP FLOATING NAVIGATION & RADAR BAR */}
      <div className="relative z-30 flex items-center justify-between p-4 sm:p-6">
        {/* Tombol Back di Pojok Kiri Atas */}
        <Link
          href="/student"
          onClick={stopCamera}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/85 hover:bg-slate-800/90 text-white text-xs font-bold border border-slate-700/70 shadow-2xl backdrop-blur-md transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Kembali</span>
        </Link>

        {/* Pop-up / Chip Melayang Lokasi GPS */}
        <div className="flex items-center gap-2">
          <button
            onClick={acquireGps}
            disabled={gpsLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/85 hover:bg-slate-800/90 border border-slate-700/70 text-white text-xs font-semibold shadow-2xl backdrop-blur-md transition-all cursor-pointer"
            title="Klik untuk segarkan GPS"
          >
            <div className="relative flex items-center justify-center">
              <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin text-blue-400" : "text-emerald-400"}`} />
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${gpsLocation ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
            </div>

            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 font-normal leading-tight">Radar Lokasi GPS</span>
              <span className="font-mono text-[11px] text-emerald-300 font-bold leading-tight truncate max-w-[130px] sm:max-w-[180px]">
                {gpsLocation ? (
                  `${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)}`
                ) : gpsLoading ? (
                  "Mencari..."
                ) : (
                  "GPS Belum Aktif"
                )}
              </span>
            </div>

            <RefreshCw className={`w-3 h-3 text-slate-400 ${gpsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. CENTER BIOMETRIC SCANNING VIEWFINDER */}
      <div className="relative z-20 flex flex-col items-center justify-center my-auto px-4 pointer-events-none">
        {/* Oval Face Scanning Guide Frame */}
        <div
          ref={guideRef}
          className={`relative w-60 h-76 sm:w-72 sm:h-92 rounded-[110px] border-2 transition-all duration-300 flex items-center justify-center ${guideBorderColor}`}
        >
          {/* Inner Corner Accents */}
          <div className="absolute inset-2 border border-white/20 rounded-[102px]" />

          {submittingAttendance && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-[108px] flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-white bg-slate-900/90 px-4 py-1.5 rounded-full border border-emerald-500/40 shadow-lg">
                Mencocokkan Wajah AI...
              </span>
            </div>
          )}
        </div>

        {/* Live Guide Floating Pill */}
        <div className="mt-5 pointer-events-auto">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 ${guideBadgeColor}`}>
            {isGuideValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : guideCode === "OUTSIDE_CIRCLE" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : guideCode ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-bold">{guideBadgeText}</span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM FLOATING CONTROLS */}
      <div className="relative z-30 p-4 sm:p-6 flex flex-col items-center gap-3 max-w-lg mx-auto w-full">
        <div className="w-full flex items-center gap-3">
          {/* Switch Camera Button */}
          <button
            onClick={toggleCameraFacing}
            type="button"
            className="p-3.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700/70 shadow-2xl backdrop-blur-md transition-all cursor-pointer shrink-0"
            title="Ganti Kamera Depan/Belakang"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>

          {/* Hands-free Auto-Scan Status / Manual Check-In Button */}
          <button
            onClick={() => executeFaceCheckIn()}
            disabled={submittingAttendance || !cameraActive}
            className={`flex-1 py-4 px-6 rounded-2xl text-white font-bold text-xs sm:text-sm tracking-wide shadow-2xl border transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 ${
              submittingAttendance
                ? "bg-emerald-950/80 border-emerald-500/50 shadow-emerald-600/30"
                : isGuideValid
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 shadow-emerald-600/40 border-emerald-400/40 ring-2 ring-emerald-500/30"
                : "bg-slate-900/90 border-slate-700/80 text-slate-300 backdrop-blur-md"
            }`}
          >
            {submittingAttendance ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="text-emerald-300 font-bold">Memverifikasi Kehadiran...</span>
              </>
            ) : isGuideValid ? (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                <span className="text-emerald-200 font-semibold">Wajah Terkunci • Otomatis Absen</span>
              </>
            ) : (
              <>
                <ScanFace className="w-4 h-4 text-slate-400" />
                <span>Posisikan Wajah untuk Absen Otomatis</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center font-medium drop-shadow-md">
          Pastikan pencahayaan cukup dan wajah terlihat jelas di kamera.
        </p>
      </div>

      {/* 5. INTERACTIVE FLOATING RESULT POP-UP (Minimalist & To the Point) */}
      {lastCheckInResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            {/* Status Icon */}
            <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
              {lastCheckInResult.status === "SUCCESS" ? (
                <div className="w-full h-full rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              ) : lastCheckInResult.status === "ALREADY_CHECKED_IN" ? (
                <div className="w-full h-full rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              ) : lastCheckInResult.status === "ACCOUNT_MISMATCH" ? (
                <div className="w-full h-full rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-7 h-7" />
                </div>
              ) : lastCheckInResult.status === "OUT_OF_RADIUS" || lastCheckInResult.status === "LOCATION_REQUIRED" ? (
                <div className="w-full h-full rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <MapPin className="w-7 h-7" />
                </div>
              ) : lastCheckInResult.status === "UNKNOWN_FACE" ? (
                <div className="w-full h-full rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <User className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-full h-full rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <XCircle className="w-7 h-7" />
                </div>
              )}
            </div>

            {/* Title & Message */}
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {lastCheckInResult.status === "SUCCESS"
                  ? "Absensi Berhasil"
                  : lastCheckInResult.status === "ALREADY_CHECKED_IN"
                  ? "Sudah Melakukan Absensi"
                  : lastCheckInResult.status === "ACCOUNT_MISMATCH"
                  ? "Identitas Tidak Sesuai"
                  : lastCheckInResult.status === "LOCATION_REQUIRED"
                  ? "Akses Lokasi Diperlukan"
                  : lastCheckInResult.status === "OUT_OF_RADIUS"
                  ? "Di Luar Jangkauan Lokasi"
                  : lastCheckInResult.status === "UNKNOWN_FACE"
                  ? "Wajah Tidak Dikenali"
                  : "Absensi Gagal"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                {lastCheckInResult.message}
              </p>
            </div>

            {/* Structured Details Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-left text-xs">
              {lastCheckInResult.status === "ACCOUNT_MISMATCH" && (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400">Akun Login:</span>
                    <span className="font-semibold text-slate-200">
                      {lastCheckInResult.loggedInName || student?.name || "Akun Anda"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400">Wajah Terdeteksi:</span>
                    <span className="font-semibold text-rose-300">
                      {lastCheckInResult.detectedName} ({lastCheckInResult.detectedClass || "-"})
                    </span>
                  </div>
                  {lastCheckInResult.similarity !== undefined && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Akurasi Kemiripan:</span>
                      <span className="font-mono text-rose-300 font-semibold">
                        {(lastCheckInResult.similarity > 1 ? lastCheckInResult.similarity : lastCheckInResult.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-medium text-rose-400">Ditolak (Anti-Titip Absen)</span>
                  </div>
                </>
              )}

              {lastCheckInResult.status === "SUCCESS" && (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400">Nama Siswa:</span>
                    <span className="font-semibold text-white">
                      {lastCheckInResult.detectedName} ({lastCheckInResult.detectedClass || "-"})
                    </span>
                  </div>
                  {lastCheckInResult.sessionTitle && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Sesi:</span>
                      <span className="font-medium text-slate-200 truncate max-w-[180px]">
                        {lastCheckInResult.sessionTitle}
                      </span>
                    </div>
                  )}
                  {lastCheckInResult.distanceMeter !== undefined && lastCheckInResult.distanceMeter !== null && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Jarak Lokasi:</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {Math.round(lastCheckInResult.distanceMeter)} meter ({lastCheckInResult.locationName || "Di Lokasi"})
                      </span>
                    </div>
                  )}
                  {lastCheckInResult.timeStr && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Waktu Tercatat:</span>
                      <span className="font-mono text-slate-200">{lastCheckInResult.timeStr} WIB</span>
                    </div>
                  )}
                </>
              )}

              {lastCheckInResult.status === "ALREADY_CHECKED_IN" && (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-slate-400">Nama Siswa:</span>
                    <span className="font-semibold text-white">
                      {lastCheckInResult.detectedName} ({lastCheckInResult.detectedClass || "-"})
                    </span>
                  </div>
                  {lastCheckInResult.sessionTitle && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Sesi:</span>
                      <span className="font-medium text-slate-200 truncate max-w-[180px]">
                        {lastCheckInResult.sessionTitle}
                      </span>
                    </div>
                  )}
                  {lastCheckInResult.timeStr && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Waktu Absen:</span>
                      <span className="font-mono text-slate-200">{lastCheckInResult.timeStr} WIB</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status Kehadiran:</span>
                    <span className="font-medium text-blue-400">Sudah Tercatat Hadir</span>
                  </div>
                </>
              )}

              {lastCheckInResult.status === "OUT_OF_RADIUS" && (
                <>
                  {lastCheckInResult.detectedName && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Nama Siswa:</span>
                      <span className="font-semibold text-white">
                        {lastCheckInResult.detectedName} ({lastCheckInResult.detectedClass || "-"})
                      </span>
                    </div>
                  )}
                  {lastCheckInResult.locationName && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Titik Sesi:</span>
                      <span className="font-medium text-slate-200 truncate max-w-[180px]">
                        {lastCheckInResult.locationName}
                      </span>
                    </div>
                  )}
                  {lastCheckInResult.distanceMeter !== undefined && lastCheckInResult.distanceMeter !== null && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Jarak Anda:</span>
                      <span className="font-mono font-semibold text-amber-400">
                        {lastCheckInResult.distanceMeter > 1000
                          ? `${(lastCheckInResult.distanceMeter / 1000).toFixed(1)} km (${Math.round(lastCheckInResult.distanceMeter).toLocaleString("id-ID")} m)`
                          : `${Math.round(lastCheckInResult.distanceMeter)} meter`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-medium text-amber-400">Di Luar Batas Radius</span>
                  </div>
                </>
              )}

              {lastCheckInResult.status === "LOCATION_REQUIRED" && (
                <>
                  {lastCheckInResult.sessionTitle && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Sesi:</span>
                      <span className="font-medium text-slate-200">
                        {lastCheckInResult.sessionTitle}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status Lokasi:</span>
                    <span className="font-medium text-amber-400">GPS Tidak Terdeteksi</span>
                  </div>
                </>
              )}

              {lastCheckInResult.status === "UNKNOWN_FACE" && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Biometrik:</span>
                  <span className="font-medium text-amber-400">Wajah Belum Terdaftar</span>
                </div>
              )}

              {lastCheckInResult.status === "ERROR" && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Keterangan:</span>
                  <span className="font-medium text-rose-400">Terjadi Kesalahan</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setLastCheckInResult(null);
                  autoScanCooldownUntilRef.current = Date.now() + 1500;
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                {lastCheckInResult.status === "SUCCESS" || lastCheckInResult.status === "ALREADY_CHECKED_IN" ? "Tutup" : "Coba Lagi"}
              </button>

              {(lastCheckInResult.status === "SUCCESS" || lastCheckInResult.status === "ALREADY_CHECKED_IN") && (
                <Link
                  href="/student"
                  onClick={stopCamera}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <span>Kembali ke Beranda</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
