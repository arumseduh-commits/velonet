"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Compass,
  Flag,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X,
  Sparkles,
  HelpCircle,
} from "lucide-react";

interface ExamTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExam?: () => void;
}

export default function ExamTutorialModal({
  isOpen,
  onClose,
  onStartExam,
}: ExamTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Aturan Ketat Anti-Kecurangan",
      tag: "Keamanan ExamBro",
      icon: ShieldAlert,
      iconBg: "bg-rose-500/20 text-rose-400 border-rose-500/40",
      description:
        "Sistem ExamBro dilengkapi pendeteksi otomatis di smartphone & laptop. Jangan berpindah tab, membagi layar (split screen), membuka aplikasi lain, atau membuka notifikasi.",
      points: [
        "Pelanggaran ke-1 & ke-2: Jawaban Anda akan DIKOSONGKAN dan ujian diulang dari soal No. 1.",
        "Pelanggaran ke-3: Akun Anda otomatis DIDISKUALIFIKASI secara permanen dengan Nilai 0.",
        "Waktu timer ujian tetap berjalan saat pelanggaran terjadi sebagai sanksi.",
      ],
    },
    {
      title: "Floating Dock & Navigasi Soal",
      tag: "Kemudahan Menjawab",
      icon: Compass,
      iconBg: "bg-blue-500/20 text-blue-400 border-blue-500/40",
      description:
        "Navigasi soal dibuat melayang (Floating Dock) di bagian bawah layar agar mudah dijangkau dengan jempol di HP maupun mouse di laptop.",
      points: [
        "Gunakan tombol [< Prev] dan [Next >] untuk berpindah soal.",
        "Klik nomor soal di tengah dock untuk membuka Kisi Palet Soal lengkap.",
        "Warna kisi: Hijau (Sudah Dijawab), Kuning (Ragu-ragu), Abu-abu (Belum Dijawab).",
      ],
    },
    {
      title: "Tanda Ragu-Ragu & Simpan Otomatis",
      tag: "Fitur Ragu-Ragu",
      icon: Flag,
      iconBg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
      description:
        "Setiap pilihan jawaban atau isian essay yang Anda pilih langsung tersimpan seketika tanpa perlu menekan tombol simpan manual.",
      points: [
        "Klik tombol bendera [🚩 Ragu-ragu] pada soal yang ingin Anda tinjau kembali nanti.",
        "Soal yang ditandai ragu-ragu akan berwarna kuning pada palet nomor soal.",
        "Klik kembali tombol bendera untuk menghapus tanda ragu-ragu.",
      ],
    },
    {
      title: "Waktu Ujian & Pengumpulan",
      tag: "Pengumpulan Hasil",
      icon: Clock,
      iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      description:
        "Pantau waktu mundur di bagian atas layar. Pastikan seluruh soal telah dijawab sebelum waktu habis.",
      points: [
        "Saat waktu tersisa 5 menit, timer akan berkedip kuning dan merah.",
        "Jika waktu habis, jawaban Anda akan otomatis dikumpulkan dan dinilai oleh sistem.",
        "Klik tombol [🚀 Kumpulkan Ujian] pada soal terakhir jika sudah selesai sebelum waktu habis.",
      ],
    },
  ];

  const slide = slides[currentStep];
  const Icon = slide.icon;
  const isLast = currentStep === slides.length - 1;

  const handleFinish = () => {
    if (dontShowAgain && typeof window !== "undefined") {
      localStorage.setItem("velonet_cbt_tutorial_seen", "true");
    }
    onClose();
    if (onStartExam) {
      onStartExam();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-700/80 text-blue-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Panduan Ujian ({currentStep + 1}/4)</span>
            </span>
          </div>

          <button
            onClick={handleFinish}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
          >
            <span>Lewati</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto sm:mx-0 shadow-lg ${slide.iconBg}">
            <Icon className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {slide.tag}
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {slide.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {slide.description}
            </p>
          </div>

          {/* Bullet Points */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-left">
            {slide.points.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{pt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Nav & Checkbox */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          {/* Step Indicator Dots */}
          <div className="flex items-center justify-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep ? "w-6 bg-blue-500" : "w-2 bg-slate-700 hover:bg-slate-600"
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
              disabled={currentStep === 0}
              className={`px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1 transition-all ${
                currentStep === 0
                  ? "opacity-30 cursor-not-allowed text-slate-500"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            {isLast ? (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <span>Saya Paham & Siap Ujian</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep((p) => Math.min(slides.length - 1, p + 1))}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dont Show Again Checkbox */}
          <label className="flex items-center justify-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan panduan ini secara otomatis lagi</span>
          </label>
        </div>
      </div>
    </div>
  );
}
