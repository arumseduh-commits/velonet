"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Smile,
  Eye,
  ArrowRight,
  User,
  ArrowLeft,
  Zap,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceLivenessAndDescriptor,
  detectFaceWithDescriptor,
  captureFrameBase64,
  computeAverageDescriptor,
  getFaceApi,
} from "@/lib/client-face-api";

type LivenessStage = "CENTER" | "BLINK" | "SMILE" | "SAMPLING" | "DONE";

export default function StudentFaceRegisterPage() {
  const router = useRouter();
  const { toast } = useDialog();

  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Liveness & Multi-Frame Sampling State
  const [livenessStage, setLivenessStage] = useState<LivenessStage>("CENTER");
  const [guideText, setGuideText] = useState("Posisikan wajah Anda tepat di dalam lingkaran oval");
  const [blinkProgress, setBlinkProgress] = useState(false);
  const [smileProgress, setSmileProgress] = useState(false);
  const [samplingProgress, setSamplingProgress] = useState(0); // 0 to 5
  const [faceDescriptorCaptured, setFaceDescriptorCaptured] = useState<number[] | null>(null);
  const [photoBase64Captured, setPhotoBase64Captured] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stableFramesRef = useRef(0);
  const isSamplingRef = useRef(false);

  // 1. Fetch Student Auth State
  useEffect(() => {
    fetch("/api/student/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.student) {
          setStudent(json.data.student);
          if (json.data.student.isFaceRegistered && json.data.student.facePhoto) {
            setPhotoBase64Captured(json.data.student.facePhoto);
          }
        } else {
          router.replace("/student/login");
        }
      })
      .catch(() => {
        router.replace("/student/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  // 2. Load Face Models
  useEffect(() => {
    loadFaceApiModels().then((ready) => {
      setModelsReady(ready);
    });
  }, []);

  // 3. Start Camera
  const startCamera = async () => {
    setCameraLoading(true);
    try {
      await loadFaceApiModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setLivenessStage("CENTER");
        setBlinkProgress(false);
        setSmileProgress(false);
        setSamplingProgress(0);
        stableFramesRef.current = 0;
        isSamplingRef.current = false;
        setGuideText("Posisikan wajah Anda tepat di dalam lingkaran oval");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error(`Kamera tidak dapat diakses: ${err.message || "Izin kamera ditolak."}`);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    isSamplingRef.current = false;
  }, []);

  // 4. Multi-Frame Burst Sampler (Cancels out sensor noise & blur on low-end cameras)
  const startBurstCapture = useCallback(async () => {
    if (!videoRef.current || isSamplingRef.current) return;
    isSamplingRef.current = true;
    setLivenessStage("SAMPLING");

    const descriptors: number[][] = [];
    let bestPhoto: string | null = null;
    const TOTAL_SAMPLES = 5;

    for (let i = 0; i < TOTAL_SAMPLES; i++) {
      setSamplingProgress(i + 1);
      setGuideText(`Mengambil sampel biometrik ${i + 1}/${TOTAL_SAMPLES} (Membersihkan noise kamera)...`);

      try {
        const detection = await detectFaceWithDescriptor(videoRef.current);
        if (detection && detection.descriptor) {
          descriptors.push(detection.descriptor);
          if (!bestPhoto || (detection.score && detection.score > 0.6)) {
            bestPhoto = captureFrameBase64(videoRef.current, detection.box);
          }
        }
      } catch (err) {
        // ignore single frame capture error
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (descriptors.length === 0) {
      toast.warning("Wajah tidak terdeteksi dengan jelas. Pastikan pencahayaan cukup dan coba lagi.");
      isSamplingRef.current = false;
      setLivenessStage("CENTER");
      setSamplingProgress(0);
      setGuideText("Posisikan wajah Anda tepat di dalam lingkaran oval");
      return;
    }

    const averagedDescriptor = computeAverageDescriptor(descriptors);
    setFaceDescriptorCaptured(averagedDescriptor);
    if (bestPhoto) {
      setPhotoBase64Captured(bestPhoto);
    }
    setBlinkProgress(true);
    setSmileProgress(true);
    setLivenessStage("DONE");
    setGuideText("Perekaman wajah selesai! Silakan simpan biometrik Anda.");
    toast.success(`Berhasil merekam ${descriptors.length} sampel biometrik bebas noise!`);
    isSamplingRef.current = false;
  }, [toast]);

  // 5. Run Relaxed Liveness & Auto-Capture Detection Loop
  const runLivenessDetection = useCallback(async () => {
    if (
      !videoRef.current ||
      !cameraActive ||
      isSuccess ||
      isSamplingRef.current ||
      livenessStage === "DONE" ||
      livenessStage === "SAMPLING"
    )
      return;

    try {
      const liveness = await detectFaceLivenessAndDescriptor(videoRef.current);

      if (liveness.detected && liveness.descriptor && liveness.box) {
        stableFramesRef.current += 1;

        if (liveness.isBlinking) {
          setBlinkProgress(true);
        }

        if (liveness.isSmiling || (liveness.smileScore && liveness.smileScore > 0.25)) {
          setSmileProgress(true);
        }

        // Smart responsive guide texts
        if (!blinkProgress && !smileProgress) {
          if (stableFramesRef.current > 6) {
            setGuideText("Kedipkan mata atau tersenyumlah sedikit (atau tahan sejenak)");
          } else {
            setGuideText("Wajah terdeteksi! Tahan posisi Anda...");
          }
        } else if (blinkProgress && !smileProgress) {
          setGuideText("Kedipan terdeteksi! Kedipkan lagi atau tersenyum");
        } else if (smileProgress && !blinkProgress) {
          setGuideText("Senyuman terdeteksi! Tahan senyuman Anda");
        }

        // Auto-Trigger burst capture:
        // 1. If blink or smile is detected, OR
        // 2. If face is centered & steady for ~2.5s (about 18 frames)
        if (liveness.isBlinking || liveness.isSmiling || stableFramesRef.current >= 18) {
          startBurstCapture();
          return;
        }
      } else {
        stableFramesRef.current = Math.max(0, stableFramesRef.current - 1);
        setGuideText("Posisikan wajah tepat di tengah lingkaran oval");
      }
    } catch (e) {
      // ignore frame analysis error
    }

    if (cameraActive && !isSuccess) {
      animationFrameRef.current = requestAnimationFrame(runLivenessDetection);
    }
  }, [cameraActive, livenessStage, isSuccess, blinkProgress, smileProgress, startBurstCapture]);

  useEffect(() => {
    if (cameraActive && livenessStage !== "DONE" && livenessStage !== "SAMPLING" && !isSuccess) {
      animationFrameRef.current = requestAnimationFrame(runLivenessDetection);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive, livenessStage, isSuccess, runLivenessDetection]);

  // 6. Submit Face Biometrics to API
  const handleSaveFace = async () => {
    if (!faceDescriptorCaptured) {
      toast.warning("Silakan ikuti instruksi kamera untuk merekam wajah terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/student/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: faceDescriptorCaptured,
          photoBase64: photoBase64Captured,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setIsSuccess(true);
        stopCamera();
        toast.success("Biometrik wajah berhasil didaftarkan!");
      } else {
        toast.error(json.error || "Gagal menyimpan biometrik wajah.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  // Manual Instant Capture Override (Runs 5-frame burst immediately)
  const handleManualCapture = async () => {
    if (!videoRef.current) return;
    toast.info("Mengambil sampel biometrik...");
    await startBurstCapture();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <span className="text-xs text-slate-500 font-medium">Memuat data siswa...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800">
        <Link
          href="/student"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Face ID AI Portal</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="my-auto py-6 space-y-6">
        {/* Title */}
        <div className="text-center space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Perekaman Biometrik Wajah
          </h1>
          <p className="text-xs text-slate-400">
            Halo <strong className="text-blue-400">{student?.name || "Peserta"}</strong> ({student?.studentClass || "Siswa"}), daftarkan wajah Anda untuk keperluan absensi kamera & verifikasi ujian CBT.
          </p>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-emerald-500/40 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Pendaftaran Wajah Berhasil!</h3>
              <p className="text-xs text-slate-300">
                Face ID Anda telah aktif. Anda sekarang dapat melakukan absensi kamera dan mengikuti ujian CBT aman.
              </p>
            </div>

            {photoBase64Captured && (
              <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto border-2 border-emerald-400 shadow-md">
                <img
                  src={photoBase64Captured}
                  alt="Snapshot Wajah"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/student"
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>Selesai & Buka Dashboard Siswa</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Camera View Container */
          <div className="space-y-4">
            <div className="relative aspect-square max-h-[340px] w-full rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl flex items-center justify-center mx-auto">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Oval Liveness Guide Frame */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    <div
                      className={`w-48 h-64 rounded-[50px] border-2 transition-all duration-300 ${
                        livenessStage === "DONE"
                          ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                          : livenessStage === "SAMPLING"
                          ? "border-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                          : "border-blue-400/80 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse"
                      }`}
                    />
                  </div>

                  {/* Sampling Burst Progress Overlay */}
                  {livenessStage === "SAMPLING" && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                      <RefreshCw className="w-10 h-10 animate-spin text-blue-400" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          Mengambil Sampel Biometrik ({samplingProgress}/5)
                        </p>
                        <p className="text-xs text-slate-300">
                          Membersihkan noise kamera & mengoptimalkan akurasi...
                        </p>
                      </div>
                      <div className="w-48 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-200"
                          style={{ width: `${(samplingProgress / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Instruction Overlay Banner */}
                  <div className="absolute bottom-3 inset-x-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 py-2 px-3 rounded-2xl text-center shadow-lg">
                    <p className="text-xs font-semibold text-slate-200">{guideText}</p>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-3">
                  {photoBase64Captured ? (
                    <div className="w-28 h-28 rounded-2xl overflow-hidden mx-auto border-2 border-emerald-400 shadow-lg relative">
                      <img
                        src={photoBase64Captured}
                        alt="Foto Wajah Terdaftar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
                      <User className="w-8 h-8" />
                    </div>
                  )}

                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {photoBase64Captured
                      ? "Wajah Anda sudah pernah terdaftar. Anda dapat merekam ulang wajah jika diinginkan."
                      : "Kamera akan memverifikasi liveness (kedipan/senyuman atau tahan stabil) dengan pengambilan 5 sampel bebas noise."}
                  </p>
                </div>
              )}
            </div>

            {/* Liveness Progress Indicators */}
            {cameraActive && (
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-2.5 rounded-2xl border flex items-center gap-2 text-xs transition-colors ${
                    blinkProgress
                      ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400"
                  }`}
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">
                    {blinkProgress ? "Kedipan Terdeteksi" : "1. Kedipkan Mata"}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-2xl border flex items-center gap-2 text-xs transition-colors ${
                    smileProgress
                      ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400"
                  }`}
                >
                  <Smile className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">
                    {smileProgress ? "Senyuman Terdeteksi" : "2. Tersenyum Santai"}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {cameraLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>{photoBase64Captured ? "Buka Kamera Rekam Ulang" : "Buka Kamera & Mulai Rekam Wajah"}</span>
                </button>
              ) : (
                <>
                  {faceDescriptorCaptured ? (
                    <button
                      type="button"
                      onClick={handleSaveFace}
                      disabled={submitting}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Simpan Biometrik Wajah Sekarang</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleManualCapture}
                      disabled={submitting || livenessStage === "SAMPLING"}
                      className="w-full py-3 px-4 rounded-2xl bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-500/40 disabled:opacity-50"
                    >
                      {livenessStage === "SAMPLING" ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      )}
                      <span>
                        {livenessStage === "SAMPLING"
                          ? `Mengambil Sampel (${samplingProgress}/5)...`
                          : "Ambil Snapshot Langsung (Bypass Sensor)"}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer border border-slate-700 text-center"
                  >
                    Tutup Kamera
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 border-t border-slate-800 pt-3">
        VeloNet Anti-Spoofing Biometric System • AI Face Recognition
      </div>
    </div>
  );
}
