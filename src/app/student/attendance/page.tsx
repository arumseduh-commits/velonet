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
  Smile,
  Zap,
  User,
  History,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceWithDescriptor,
  captureFrameBase64,
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
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelsReady, setModelsReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  // Recognition Result Modal Popup State
  const [lastCheckInResult, setLastCheckInResult] = useState<{
    status: "SUCCESS" | "ACCOUNT_MISMATCH" | "UNKNOWN_FACE" | "OUT_OF_RADIUS" | "NO_SESSION" | "ERROR";
    message: string;
    detectedName?: string;
    detectedClass?: string;
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
          width: { ideal: 640 },
          height: { ideal: 640 },
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

  // Auto-start camera when models are loaded
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

  // 5. Handle Face Recognition Attendance Check-In
  const handlePerformFaceCheckIn = async () => {
    if (!videoRef.current || !cameraActive) {
      toast.warning("Silakan aktifkan kamera terlebih dahulu.");
      return;
    }

    if (!modelsReady) {
      toast.warning("Model AI Face Recognition sedang dimuat, mohon tunggu sebentar...");
      return;
    }

    setScanning(true);
    setSubmittingAttendance(true);
    setLastCheckInResult(null);

    try {
      // 1. Detect Face and Extract Biometric Vector
      const detection = await detectFaceWithDescriptor(videoRef.current);

      if (!detection) {
        toast.warning("Wajah tidak terdeteksi di kamera! Posisikan wajah Anda tepat di dalam lingkaran.");
        setScanning(false);
        setSubmittingAttendance(false);
        return;
      }

      const photoBase64 = captureFrameBase64(videoRef.current, detection.box);

      // 2. Send to Backend Verifier
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
      } else if (json.code === "ACCOUNT_MISMATCH") {
        setLastCheckInResult({
          status: "ACCOUNT_MISMATCH",
          message: json.message || "Wajah terdeteksi milik akun peserta lain. Dilarang titip absen.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
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
      setScanning(false);
      setSubmittingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Menyiapkan Kamera Absensi Wajah...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-5 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>Absen Wajah (Face Recognition)</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pindai wajah Anda untuk verifikasi kehadiran dan pencatatan lokasi GPS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/student/profile"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span>Lihat Riwayat di Profil</span>
          </Link>
        </div>
      </div>

      {/* Smart GPS Geofence Radar Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white">Status Radar GPS: </span>
            {gpsLocation ? (
              <span className="text-emerald-400 font-mono">
                {gpsLocation.latitude.toFixed(5)}, {gpsLocation.longitude.toFixed(5)} (±{Math.round(gpsLocation.accuracy || 0)}m)
              </span>
            ) : gpsLoading ? (
              <span className="text-amber-400 animate-pulse">Mendeteksi koordinat...</span>
            ) : (
              <span className="text-rose-400">{gpsError || "Lokasi belum terdeteksi"}</span>
            )}
          </div>
        </div>

        <button
          onClick={acquireGps}
          disabled={gpsLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin text-blue-400" : ""}`} />
          <span>Refresh GPS</span>
        </button>
      </div>

      {/* FULL CAMERA SCANNER VIEWPORT */}
      <div className="p-4 sm:p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-slate-200">Kamera Pemindai AI</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleCameraFacing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Ganti Kamera</span>
            </button>
          </div>
        </div>

        {/* Camera Container with Oval Guide */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[500px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === "user" ? "transform -scale-x-100" : ""}`}
          />

          {/* Oval Face Scanning Guide Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-52 h-64 sm:w-64 sm:h-80 rounded-[100px] border-2 border-dashed border-emerald-400/70 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-pulse" />
          </div>

          {/* Scanning Overlay Animation */}
          {scanning && (
            <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-white bg-slate-950/80 px-4 py-1.5 rounded-full border border-emerald-500/40">
                Mencocokkan Biometrik Wajah & GPS...
              </span>
            </div>
          )}
        </div>

        {/* Scan Action Button */}
        <div className="pt-2">
          <button
            onClick={handlePerformFaceCheckIn}
            disabled={submittingAttendance || !cameraActive}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            {submittingAttendance ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Memproses Absensi Wajah...</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>PINDAI WAJAH SEKARANG (ABSEN)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CUSTOM POPUP MODAL DIALOG: HASIL ABSENSI, AKURASI & LOKASI */}
      {lastCheckInResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            {/* Status Icon */}
            <div className="mx-auto w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl">
              {lastCheckInResult.status === "SUCCESS" ? (
                <div className="w-full h-full rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
              ) : lastCheckInResult.status === "ACCOUNT_MISMATCH" ? (
                <div className="w-full h-full rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-9 h-9" />
                </div>
              ) : lastCheckInResult.status === "OUT_OF_RADIUS" ? (
                <div className="w-full h-full rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <MapPin className="w-9 h-9" />
                </div>
              ) : (
                <div className="w-full h-full rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <XCircle className="w-9 h-9" />
                </div>
              )}
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                {lastCheckInResult.status === "SUCCESS"
                  ? "Absensi Berhasil Diverifikasi! 🎉"
                  : lastCheckInResult.status === "ACCOUNT_MISMATCH"
                  ? "Wajah Akun Tidak Cocok"
                  : lastCheckInResult.status === "OUT_OF_RADIUS"
                  ? "Di Luar Radius Lokasi Kumpul"
                  : "Absensi Gagal"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lastCheckInResult.message}
              </p>
            </div>

            {/* Biometric & GPS Details Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-left text-xs">
              {lastCheckInResult.detectedName && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Nama Siswa:</span>
                  <span className="font-bold text-white">{lastCheckInResult.detectedName} ({lastCheckInResult.detectedClass || "-"})</span>
                </div>
              )}

              {lastCheckInResult.similarity !== undefined && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Akurasi Wajah (AI Match):</span>
                  <span className="font-mono font-extrabold text-emerald-400">
                    {(lastCheckInResult.similarity * 100).toFixed(1)}% Cocok
                  </span>
                </div>
              )}

              {lastCheckInResult.distanceMeter !== undefined && lastCheckInResult.distanceMeter !== null && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Jarak ke Titik Kumpul:</span>
                  <span className="font-mono font-bold text-blue-300">
                    {Math.round(lastCheckInResult.distanceMeter)} meter ({lastCheckInResult.locationName || "Titik Kumpul"})
                  </span>
                </div>
              )}

              {lastCheckInResult.timeStr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Waktu Tercatat:</span>
                  <span className="font-mono text-slate-200">{lastCheckInResult.timeStr}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                onClick={() => setLastCheckInResult(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>

              {lastCheckInResult.status === "SUCCESS" && (
                <Link
                  href="/student/profile"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lihat di Profil</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
