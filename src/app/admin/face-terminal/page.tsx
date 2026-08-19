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
    loadFaceApiModels().then((ready) => setModelsReady(ready));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setKioskGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      });
    }
  }, [fetchData]);

  // 2. Camera Controls
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setFacingMode(mode);
      }
    } catch (err: any) {
      toast.error(`Kamera tidak dapat diakses: ${err.message}`);
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

  useEffect(() => {
    startCamera();
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

        if (json.code === "SUCCESS") {
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
                status: "SUCCESS",
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
  }, [cameraActive, modelsReady, isContinuousScanning, kioskGps, audioFeedback]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/40 border border-blue-500/20 shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                Terminal Absensi Face Recognition
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold animate-pulse">
                LIVE KIOSK
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mode pemindaian otomatis di meja registrasi pintu masuk lokasi pertemuan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAudioFeedback((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              audioFeedback
                ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>Suara {audioFeedback ? "Aktif" : "Mati"}</span>
          </button>

          <button
            onClick={() => setFacingMode((prev) => (prev === "user" ? "environment" : "user"))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Ganti Kamera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Session Info Pill */}
      {activeSessions.length > 0 ? (
        <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Sesi Aktif Saat Ini: <b>{activeSessions[0].title}</b> di <b>{activeSessions[0].locationName || "Titik Kumpul"}</b>
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            {new Date(activeSessions[0].startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
            {new Date(activeSessions[0].endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Tidak ada sesi pertemuan yang sedang aktif saat ini. Buat sesi di menu Sesi Absensi.</span>
        </div>
      )}

      {/* Main Terminal Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Live Stream (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-2xl relative">
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {/* Scanning Target Box */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-52 h-64 rounded-[40px] border-2 border-blue-500/60 shadow-[0_0_30px_rgba(59,130,246,0.25)] relative flex items-center justify-center animate-pulse">
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-400" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-400" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-400" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-400" />
                </div>
              </div>

              {/* Floating Real-time Identification Pill */}
              {currentDetection && (
                <div className="absolute bottom-4 inset-x-4 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base ${
                        currentDetection.status === "MATCH"
                          ? "bg-gradient-to-tr from-emerald-500 to-teal-500"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {currentDetection.status === "MATCH" ? currentDetection.name.charAt(0) : "X"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{currentDetection.name}</h4>
                      <p className="text-[11px] text-slate-400">Kelas {currentDetection.studentClass}</p>
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
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Total Wajah Terdaftar:</span>
                <p className="text-lg font-bold text-white mt-0.5">{enrolledStudents.length} Siswa</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Kehadiran Hari Ini:</span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{recentScans.length} Check-in</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Attendance Activity Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Aktivitas Check-In Masuk</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500">Real-time Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <Camera className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">Menunggu siswa melakukan scan wajah di kamera...</p>
                </div>
              ) : (
                recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {scan.photo ? (
                        <img
                          src={scan.photo}
                          alt={scan.name}
                          className="w-9 h-9 rounded-xl object-cover border border-emerald-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                          {scan.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{scan.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          Kelas {scan.studentClass} • {scan.similarity}% Cocok
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                        HADIR
                      </span>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{scan.time}</p>
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
