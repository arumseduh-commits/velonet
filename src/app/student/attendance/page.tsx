"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  Navigation,
  CalendarCheck,
  Award,
  Maximize2,
  SwitchCamera,
  Smile,
  Zap,
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

interface AttendanceRecord {
  id: string;
  sessionTitle: string;
  sessionDate: string;
  status: string;
  method: string;
  checkInTime: string;
  distanceMeter: number | null;
  notes: string | null;
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const { toast, confirm } = useDialog();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
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

  // Enrollment Modal / Flow State
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [enrollingStep, setEnrollingStep] = useState<"IDLE" | "CAPTURING" | "SAVING" | "DONE">("IDLE");

  // Recognition Feedback Result State
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
        setRecords(meJson.data.recentAttendances || []);
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
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
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
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    startCamera(nextMode);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 5. Handle Face Enrollment (Perekaman Wajah Awal)
  const handleStartEnrollment = async () => {
    if (!cameraActive) {
      await startCamera();
    }
    setIsEnrolling(true);
    setEnrollingStep("CAPTURING");
    setEnrollmentProgress(0);

    toast.info("Arahkan wajah Anda ke tengah lingkaran kamera dan tahan selama 2 detik...");

    let capturedFrames: DetectedFaceData[] = [];
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const detection = await detectFaceWithDescriptor(videoRef.current);
      if (detection) {
        capturedFrames.push(detection);
        const progress = Math.min(100, Math.round((capturedFrames.length / 3) * 100));
        setEnrollmentProgress(progress);
      }

      if (capturedFrames.length >= 3 || attempts >= 20) {
        clearInterval(interval);

        if (capturedFrames.length < 3) {
          toast.error("Gagal mendeteksi wajah dengan jelas. Pastikan pencahayaan cukup dan wajah menghadap kamera.");
          setIsEnrolling(false);
          setEnrollingStep("IDLE");
          return;
        }

        // Average descriptor or pick best frame
        setEnrollingStep("SAVING");
        toast.info("Memproses dan menyimpan vektor biometrik wajah...");

        const bestFrame = capturedFrames[0];
        const photoBase64 = captureFrameBase64(videoRef.current, bestFrame.box);

        try {
          const res = await fetch("/api/student/face/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              faceDescriptor: bestFrame.descriptor,
              photoBase64,
            }),
          });

          const json = await res.json();
          if (json.success) {
            toast.success("Perekaman wajah berhasil! Anda sekarang bisa melakukan absensi wajah.");
            setEnrollingStep("DONE");
            setIsEnrolling(false);
            fetchInitialData();
          } else {
            toast.error(json.error || "Gagal menyimpan data biometrik wajah.");
            setEnrollingStep("IDLE");
          }
        } catch (e: any) {
          toast.error(e.message || "Gagal menghubungi server.");
          setEnrollingStep("IDLE");
        }
      }
    }, 400);
  };

  // 6. Handle Face Recognition Attendance Check-In
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
        toast.warning("Wajah tidak terdeteksi di kamera! Pastikan wajah Anda terlihat jelas.");
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
        toast.success(json.message?.replace(/\*/g, "") || "Absensi wajah berhasil diverifikasi!");
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
        fetchInitialData();
      } else if (json.code === "ACCOUNT_MISMATCH") {
        toast.error("Wajah terdeteksi milik peserta lain! Dilarang titip absen.");
        setLastCheckInResult({
          status: "ACCOUNT_MISMATCH",
          message: json.message || "Wajah tidak cocok dengan akun yang sedang login.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
        });
      } else if (json.code === "UNKNOWN_FACE") {
        toast.error("Wajah tidak dikenali atau belum terdaftar sebagai anggota Velocity.");
        setLastCheckInResult({
          status: "UNKNOWN_FACE",
          message: json.message || "Wajah tidak terdaftar di sistem.",
        });
      } else if (json.code === "OUT_OF_RADIUS") {
        toast.error(`Di luar area lokasi kumpul: ${json.distanceMeter || "-"}m dari titik kumpul.`);
        setLastCheckInResult({
          status: "OUT_OF_RADIUS",
          message: json.message || "Lokasi Anda di luar radius toleransi sesi.",
          detectedName: json.detectedUser?.name,
          detectedClass: json.detectedUser?.studentClass,
          similarity: json.similarity,
          distanceMeter: json.distanceMeter,
          sessionTitle: json.sessionTitle,
          locationName: json.locationName,
        });
      } else {
        toast.error(json.message || json.error || "Gagal melakukan absensi.");
        setLastCheckInResult({
          status: "ERROR",
          message: json.message || json.error || "Terjadi kesalahan.",
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
        <span className="text-sm font-medium">Memuat Sistem Absensi Wajah...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-5xl mx-auto pb-24 md:pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/20 shadow-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <Camera className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Absensi Face Recognition & Lokasi
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Absensi mandiri menggunakan pemindai biometrik wajah AI dan verifikasi koordinat lokasi otomatis
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {student?.isFaceRegistered ? (
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Wajah Terdaftar</span>
              </span>
            ) : (
              <button
                onClick={handleStartEnrollment}
                className="px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Rekam Wajah Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Smart Auto-Location Status Card */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5 sm:mt-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">Smart Auto-Location Radar</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold">
                Geofencing Aktif
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {gpsLocation ? (
                <span>
                  Koordinat GPS: <span className="font-mono text-emerald-400">{gpsLocation.latitude.toFixed(5)}, {gpsLocation.longitude.toFixed(5)}</span> (Akurasi: ±{Math.round(gpsLocation.accuracy || 0)}m)
                </span>
              ) : gpsLoading ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Mengambil koordinat GPS lokasi Anda...
                </span>
              ) : (
                <span className="text-rose-400">{gpsError || "GPS belum aktif."}</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={acquireGps}
          disabled={gpsLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin text-blue-400" : ""}`} />
          <span>Segarkan Lokasi</span>
        </button>
      </div>

      {/* Main Face Recognition Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Camera Viewport (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 sm:p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-2xl relative overflow-hidden">
            {/* Camera Controls Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cameraActive ? "bg-emerald-400 animate-ping" : "bg-slate-600"}`} />
                <span className="text-xs font-bold text-slate-300">
                  {cameraActive ? "Kamera Aktif • Menunggu Pindai" : "Kamera Nonaktif"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {cameraActive && (
                  <button
                    onClick={toggleCameraFacing}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    title="Ganti Kamera Depan / Belakang"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => (cameraActive ? stopCamera() : startCamera())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    cameraActive
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  }`}
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="w-4 h-4" />
                      <span>Matikan Kamera</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Nyalakan Kamera</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Video Feed Box */}
            <div className="relative aspect-video sm:aspect-4/3 max-h-[380px] w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3 bg-slate-950/80 backdrop-blur-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <p className="text-sm font-bold text-white">Kamera Belum Dinyalakan</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tekan tombol <b>Nyalakan Kamera</b> di atas untuk mulai melakukan verifikasi wajah absensi.
                    </p>
                  </div>
                  <button
                    onClick={() => startCamera()}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Aktifkan Kamera Sekarang</span>
                  </button>
                </div>
              )}

              {/* Scanning Laser / Face Guide Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Face Target Ellipse / Rounded Guide */}
                  <div className="w-48 h-64 sm:w-56 sm:h-72 rounded-[45px] border-2 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.25)] relative flex items-center justify-center animate-pulse">
                    {/* Crosshair corners */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                    {scanning && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] animate-bounce" />
                    )}
                  </div>
                </div>
              )}

              {/* Enrollment Progress Overlay */}
              {isEnrolling && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">Merekam Vektor Wajah AI</h3>
                    <p className="text-xs text-slate-300">
                      Tahan posisi wajah Anda di tengah lingkaran kamera...
                    </p>
                  </div>
                  <div className="w-full max-w-xs bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${enrollmentProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">{enrollmentProgress}%</span>
                </div>
              )}
            </div>

            {/* Action Check-In Button */}
            <div className="pt-2">
              <button
                onClick={handlePerformFaceCheckIn}
                disabled={!cameraActive || submittingAttendance || scanning}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingAttendance ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Menganalisis Biometrik & Lokasi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Verifikasi Wajah & Absen Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Recognition & Verification Feedback Card (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Recognition Result Card */}
          <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Status Verifikasi Akurasi</span>
            </h2>

            {lastCheckInResult ? (
              <div
                className={`p-4 rounded-2xl border space-y-3 animate-in fade-in duration-300 ${
                  lastCheckInResult.status === "SUCCESS"
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : lastCheckInResult.status === "ACCOUNT_MISMATCH"
                    ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                    : lastCheckInResult.status === "OUT_OF_RADIUS"
                    ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {lastCheckInResult.status === "SUCCESS" && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {lastCheckInResult.status === "ACCOUNT_MISMATCH" && (
                    <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  {lastCheckInResult.status === "UNKNOWN_FACE" && (
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  {lastCheckInResult.status === "OUT_OF_RADIUS" && (
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">
                      {lastCheckInResult.status === "SUCCESS"
                        ? "Absensi Berhasil Terverifikasi!"
                        : lastCheckInResult.status === "ACCOUNT_MISMATCH"
                        ? "Absensi Ditolak: Wajah Tidak Cocok"
                        : lastCheckInResult.status === "UNKNOWN_FACE"
                        ? "Wajah Tidak Dikenali"
                        : lastCheckInResult.status === "OUT_OF_RADIUS"
                        ? "Di Luar Area Pertemuan"
                        : "Hasil Pindai"}
                    </h3>
                    <p className="text-xs whitespace-pre-line leading-relaxed">
                      {lastCheckInResult.message}
                    </p>
                  </div>
                </div>

                {/* Accuracy Metrics */}
                {lastCheckInResult.similarity !== undefined && (
                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Skor Kemiripan:</span>
                      <p className="font-bold text-white font-mono">{lastCheckInResult.similarity}%</p>
                    </div>
                    {lastCheckInResult.distanceMeter !== undefined && lastCheckInResult.distanceMeter !== null && (
                      <div>
                        <span className="text-slate-400">Jarak Lokasi:</span>
                        <p className="font-bold text-white font-mono">{lastCheckInResult.distanceMeter}m</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 space-y-2">
                <Smile className="w-8 h-8 mx-auto text-slate-500" />
                <p className="text-xs leading-relaxed">
                  Arahkan wajah ke kamera dan tekan <b>Verifikasi Wajah</b> untuk melihat hasil pengenalan identitas.
                </p>
              </div>
            )}

            {/* Profile Info Summary */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Akun Anda:</span>
                <span className="font-bold text-white">{student?.name}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Kelas:</span>
                <span className="font-semibold text-emerald-400">{student?.studentClass}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Status Biometrik:</span>
                <span className="font-semibold text-white">
                  {student?.isFaceRegistered ? "Terdaftar ✅" : "Belum Direkam ⚠️"}
                </span>
              </div>
            </div>

            {!student?.isFaceRegistered && (
              <button
                onClick={handleStartEnrollment}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Rekam Wajah Anda Sekarang</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attendance History Table Card */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
            <span>Riwayat Absensi Pertemuan</span>
          </h2>
        </div>

        <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama Sesi</th>
                  <th className="py-3.5 px-4">Waktu Check-In</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Metode</th>
                  <th className="py-3.5 px-4">Jarak GPS</th>
                  <th className="py-3.5 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat absensi sesi pertemuan.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {r.sessionTitle}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(r.checkInTime).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            r.status === "HADIR"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : r.status === "IZIN" || r.status === "SAKIT"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {r.method === "FACE_LOCATION" || r.method === "FACE_RECOGNITION"
                          ? "📸 Wajah + Lokasi"
                          : r.method === "WEB_GPS"
                          ? "🌐 Browser GPS Web"
                          : "📍 Lokasi WA"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                        {r.distanceMeter != null ? `${r.distanceMeter}m` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {r.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
