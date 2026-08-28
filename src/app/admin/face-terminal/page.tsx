"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
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
  Volume2,
  VolumeX,
  Users,
  Search,
  ArrowLeft,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceWithDescriptor,
  captureFrameBase64,
  validateFaceInGuide,
  FaceValidationResult,
} from "@/lib/client-face-api";

interface EnrolledStudent {
  id: string;
  name: string;
  studentClass: string;
  phoneNumber: string;
  gender: string | null;
  facePhoto: string | null;
  descriptor: number[];
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

export default function AdminFaceTerminalPage() {
  const { toast } = useDialog();

  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Camera & Face API
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const [guideValidation, setGuideValidation] = useState<FaceValidationResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelsReady, setModelsReady] = useState(false);
  const [isContinuousScanning, setIsContinuousScanning] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // GPS for Kiosk Device
  const [kioskGps, setKioskGps] = useState<{ latitude: number; longitude: number } | null>(null);

  // Recognition Event Feed
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      name: string;
      studentClass: string;
      status: "SUCCESS" | "UNKNOWN" | "OUT_OF_RADIUS" | "ALREADY_CHECKED";
      time: string;
      similarity: number;
      photo?: string;
    }>
  >([]);

  const [currentDetection, setCurrentDetection] = useState<{
    name: string;
    studentClass: string;
    similarity: number;
    status: "MATCH" | "UNKNOWN";
  } | null>(null);

  // Cooldown tracker: prevent spamming same user within 8 seconds
  const lastProcessedTimeRef = useRef<{ [userId: string]: number }>({});
  const isProcessingRef = useRef(false);

  // 1. Fetch Enrolled Students & Active Sessions
  const fetchData = useCallback(async () => {
    try {
      const [descRes, sessRes] = await Promise.all([
        fetch("/api/attendance/face-descriptors"),
        fetch("/api/attendance/active-locations"),
      ]);

      const descJson = await descRes.json();
      if (descJson.success && descJson.data) {
        setEnrolledStudents(descJson.data);
      }

      const sessJson = await sessRes.json();
      if (sessJson.success && sessJson.data) {
        setActiveSessions(sessJson.data);
      }
    } catch (e) {
      console.error("Failed to load terminal data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Initialize Models & Camera
  const startCamera = async () => {
    try {
      setLoading(true);
      await loadFaceApiModels();
      setModelsReady(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error("Gagal mengakses kamera terminal. Pastikan izin kamera aktif.");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    startCamera();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setKioskGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      });
    }

    return () => stopCamera();
  }, []);

  // 3. Audio Voice Announcement
  const speakGreeting = (name: string) => {
    if (!audioFeedback || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Selamat datang, ${name}!`);
      utterance.lang = "id-ID";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  // 4. Continuous Live Scanning Loop
  useEffect(() => {
    if (!cameraActive || !modelsReady || !isContinuousScanning) return;

    let isMounted = true;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !videoRef.current || videoRef.current.paused) return;

      try {
        const detection = await detectFaceWithDescriptor(videoRef.current);
        if (!detection || !isMounted) {
          setCurrentDetection(null);
          setGuideValidation(null);
          return;
        }

        const valResult = validateFaceInGuide(videoRef.current, detection, guideRef.current, facingMode);
        setGuideValidation(valResult);

        // Guard: Face must be centered inside the guide box
        if (!valResult.isValid) {
          return;
        }

        isProcessingRef.current = true;
        const photoBase64 = captureFrameBase64(videoRef.current, detection.box);

        // Send to backend verifier
        const res = await fetch("/api/attendance/face-checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faceDescriptor: detection.descriptor,
            latitude: kioskGps?.latitude,
            longitude: kioskGps?.longitude,
            photoBase64,
          }),
        });

        const json = await res.json();
        const nowMs = Date.now();
        const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        if (json.code === "SUCCESS" || json.code === "ALREADY_CHECKED_IN") {
          const userId = json.detectedUser?.id || "unknown";
          const lastTime = lastProcessedTimeRef.current[userId] || 0;

          setCurrentDetection({
            name: json.detectedUser?.name || "Peserta",
            studentClass: json.detectedUser?.studentClass || "-",
            similarity: json.similarity || 0,
            status: "MATCH",
          });

          // Check cooldown to avoid audio spam
          if (nowMs - lastTime > 8000) {
            lastProcessedTimeRef.current[userId] = nowMs;
            speakGreeting(json.detectedUser?.name || "Peserta");

            setRecentScans((prev) => [
              {
                id: Math.random().toString(),
                name: json.detectedUser?.name || "Peserta",
                studentClass: json.detectedUser?.studentClass || "-",
                status: json.code === "ALREADY_CHECKED_IN" ? "ALREADY_CHECKED" : "SUCCESS",
                time: timeStr,
                similarity: json.similarity || 0,
                photo: photoBase64 || undefined,
              },
              ...prev.slice(0, 19),
            ]);
          }
        } else if (json.code === "UNKNOWN_FACE") {
          setCurrentDetection({
            name: "Wajah Tidak Dikenali",
            studentClass: "Bukan Anggota",
            similarity: 0,
            status: "UNKNOWN",
          });
        }
      } catch (e) {
        console.error("Scan loop error:", e);
      } finally {
        isProcessingRef.current = false;
      }
    }, 800);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cameraActive, modelsReady, isContinuousScanning, kioskGps, audioFeedback, facingMode]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white border border-blue-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Terminal Absensi Face Recognition
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold animate-pulse">
                LIVE KIOSK
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Mode pemindaian otomatis di meja registrasi pintu masuk lokasi pertemuan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAudioFeedback((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              audioFeedback
                ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {audioFeedback ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>Suara {audioFeedback ? "Aktif" : "Mati"}</span>
          </button>

          <button
            onClick={() => setFacingMode((prev) => (prev === "user" ? "environment" : "user"))}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer shadow-sm"
            title="Ganti Kamera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Session Info Pill */}
      {activeSessions.length > 0 ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 font-medium">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sesi Aktif Saat Ini: <b>{activeSessions[0].title}</b> di <b>{activeSessions[0].locationName || "Titik Kumpul"}</b>
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 font-bold">
            {new Date(activeSessions[0].startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
            {new Date(activeSessions[0].endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Tidak ada sesi pertemuan yang sedang aktif saat ini. Buat sesi di menu Sesi Absensi.</span>
        </div>
      )}

      {/* Main Terminal Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Live Stream (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm relative">
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl border-4 border-slate-200 overflow-hidden flex items-center justify-center shadow-lg">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {/* Scanning Target Box */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  ref={guideRef}
                  className={`w-52 h-64 rounded-[40px] border-2 transition-all duration-300 relative flex items-center justify-center ${
                    guideValidation?.isValid
                      ? "border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.35)]"
                      : guideValidation?.code === "OUTSIDE_CIRCLE"
                      ? "border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.35)]"
                      : guideValidation?.code
                      ? "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.35)]"
                      : "border-blue-500/60 shadow-[0_0_30px_rgba(59,130,246,0.25)] animate-pulse"
                  }`}
                >
                  <div
                    className={`absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                      guideValidation?.isValid ? "border-emerald-300" : "border-blue-400"
                    }`}
                  />
                  <div
                    className={`absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                      guideValidation?.isValid ? "border-emerald-300" : "border-blue-400"
                    }`}
                  />
                  <div
                    className={`absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                      guideValidation?.isValid ? "border-emerald-300" : "border-blue-400"
                    }`}
                  />
                  <div
                    className={`absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                      guideValidation?.isValid ? "border-emerald-300" : "border-blue-400"
                    }`}
                  />
                </div>
              </div>

              {/* Floating Real-time Identification Pill */}
              {currentDetection && (
                <div className="absolute bottom-4 inset-x-4 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base ${
                        currentDetection.status === "MATCH"
                          ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {currentDetection.status === "MATCH" ? currentDetection.name.charAt(0) : "X"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{currentDetection.name}</h4>
                      <p className="text-[11px] text-slate-300">Kelas {currentDetection.studentClass}</p>
                    </div>
                  </div>

                  {currentDetection.similarity > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">Kemiripan:</span>
                      <p className="text-xs font-mono font-bold text-emerald-400">
                        {currentDetection.similarity}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Status Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-semibold">Total Wajah Terdaftar:</span>
                <p className="text-lg font-black text-slate-900 mt-0.5">{enrolledStudents.length} Siswa</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 font-semibold">Kehadiran Hari Ini:</span>
                <p className="text-lg font-black text-emerald-700 mt-0.5">{recentScans.length} Check-in</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Attendance Activity Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm flex flex-col h-[540px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Aktivitas Check-In Masuk</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400 font-bold">Real-time Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <Camera className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-medium">Menunggu siswa melakukan scan wajah di kamera...</p>
                </div>
              ) : (
                recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-all flex items-center justify-between gap-3 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {scan.photo ? (
                        <img
                          src={scan.photo}
                          alt={scan.name}
                          className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                          {scan.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{scan.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          Kelas {scan.studentClass} • {scan.similarity}% Cocok
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        HADIR
                      </span>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 font-medium">{scan.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

