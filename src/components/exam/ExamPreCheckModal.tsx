"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Camera,
  Maximize,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";

interface ExamPreCheckModalProps {
  quizTitle: string;
  durationMinutes: number;
  maxStrikes: number;
  enableCamera: boolean;
  enableFullscreen: boolean;
  onStartExam: () => void;
}

export default function ExamPreCheckModal({
  quizTitle,
  durationMinutes,
  maxStrikes,
  enableCamera,
  enableFullscreen,
  onStartExam,
}: ExamPreCheckModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">(
    enableCamera ? "pending" : "granted"
  );
  const [testingCamera, setTestingCamera] = useState(false);

  useEffect(() => {
    if (enableCamera) {
      checkCameraAccess();
    }
  }, [enableCamera]);

  const checkCameraAccess = async () => {
    setTestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission("granted");
    } catch (err) {
      console.warn("Camera permission denied:", err);
      setCameraPermission("denied");
    } finally {
      setTestingCamera(false);
    }
  };

  const isReadyToStart =
    hasAgreed && (enableCamera ? cameraPermission === "granted" : true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 my-8">
        {/* Header Icon */}
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              VeloExambro Secure CBT
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              Verifikasi Kesiapan Ujian
            </h2>
          </div>
        </div>

        {/* Exam Meta Info */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="text-sm font-bold text-slate-800 line-clamp-1">{quizTitle}</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Durasi: <strong>{durationMinutes} Menit</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Batas Pelanggaran: <strong>{maxStrikes}x Strike</strong></span>
            </div>
          </div>
        </div>

        {/* Security Rules Checklist */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Protokol Keamanan & Anti-Kecurangan:
          </h3>

          <div className="space-y-2 text-xs text-slate-700">
            {enableFullscreen && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200">
                <Maximize className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Mode Layar Penuh (Fullscreen) Wajib</strong>
                  Ujian akan berjalan dalam layar penuh. Keluar dari fullscreen akan dihitung sebagai pelanggaran.
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block font-semibold">Dilarang Pindah Tab / Aplikasi</strong>
                Membuka browser lain, split screen, atau beralih aplikasi akan otomatis memicu peringatan sistem.
              </div>
            </div>

            {enableCamera && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200">
                <Camera className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900 font-semibold">AI Face Proctoring</strong>
                    {cameraPermission === "granted" ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Siap
                      </span>
                    ) : (
                      <button
                        onClick={checkCameraAccess}
                        disabled={testingCamera}
                        className="text-[11px] font-semibold text-blue-600 underline hover:text-blue-700 cursor-pointer"
                      >
                        {testingCamera ? "Memeriksa..." : "Izinkan Kamera"}
                      </button>
                    )}
                  </div>
                  Kamera depan memantau kehadiran wajah Anda dan mendeteksi jika ada orang lain di samping Anda.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agreement Checkbox */}
        <label className="mt-5 flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
          />
          <span className="text-xs text-blue-900 font-medium leading-relaxed">
            Saya mengerti dan setuju untuk mengikuti ujian secara jujur serta mematuhi seluruh aturan VeloExambro.
          </span>
        </label>

        {/* Action Button */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStartExam}
            disabled={!isReadyToStart}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              isReadyToStart
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.98]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span>Mulai Ujian Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
