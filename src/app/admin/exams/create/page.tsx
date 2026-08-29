"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Copy,
  MoveUp,
  MoveDown,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  ShieldAlert,
  BrainCircuit,
  Clock,
  KeyRound,
  Maximize,
  Camera,
  Layers,
  HelpCircle,
  Sparkles,
  FileSpreadsheet,
  X,
  RefreshCw,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export interface OptionItem {
  text: string;
  isCorrect: boolean;
}

export interface QuestionItem {
  id: string;
  type: "SINGLE_CHOICE" | "CHECKBOXES" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  imageUrl?: string | null;
  points: number;
  order: number;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  caseSensitive?: boolean;
  options: OptionItem[];
}

export async function compressImageToWebP(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve) => {
    // If already SVG or GIF, don't re-encode
    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
              const webpFile = new File(
                [blob],
                `${baseName}.webp`,
                { type: "image/webp" }
              );
              resolve(webpFile);
            },
            "image/webp",
            quality
          );
        } catch (canvasErr) {
          console.warn("WebP compression failed, using original file:", canvasErr);
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function CreateExamPage() {
  const router = useRouter();
  const { confirm, toast } = useDialog();

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "settings">("questions");
  const [uploadingImgIdx, setUploadingImgIdx] = useState<number | null>(null);

  // Exam Meta & Security Settings
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [enableFullscreenLock, setEnableFullscreenLock] = useState(true);
  const [enableTabSwitchDetect, setEnableTabSwitchDetect] = useState(true);
  const [maxStrikes, setMaxStrikes] = useState(3);
  const [enableCameraProctor, setEnableCameraProctor] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState("123456");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [examToken, setExamToken] = useState("");
  const [showScoreImmediately, setShowScoreImmediately] = useState(true);
  const [showDiscussion, setShowDiscussion] = useState(false);

  // Questions List
  const [questions, setQuestions] = useState<QuestionItem[]>([
    {
      id: "q_1",
      type: "SINGLE_CHOICE",
      text: "Pertanyaan pilihan ganda nomor 1...",
      imageUrl: null,
      points: 10,
      order: 0,
      options: [
        { text: "Pilihan A", isCorrect: true },
        { text: "Pilihan B", isCorrect: false },
        { text: "Pilihan C", isCorrect: false },
        { text: "Pilihan D", isCorrect: false },
      ],
    },
  ]);

  // Total Points Calculator
  const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  // Add Question Handler
  const handleAddQuestion = (
    type: "SINGLE_CHOICE" | "CHECKBOXES" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" = "SINGLE_CHOICE"
  ) => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let initialOptions: OptionItem[] = [];

    if (type === "SINGLE_CHOICE" || type === "CHECKBOXES") {
      initialOptions = [
        { text: "Pilihan A", isCorrect: true },
        { text: "Pilihan B", isCorrect: false },
        { text: "Pilihan C", isCorrect: false },
        { text: "Pilihan D", isCorrect: false },
      ];
    } else if (type === "TRUE_FALSE") {
      initialOptions = [
        { text: "Benar", isCorrect: true },
        { text: "Salah", isCorrect: false },
      ];
    }

    const newQuestion: QuestionItem = {
      id: newId,
      type,
      text: `Pertanyaan baru #${questions.length + 1}...`,
      imageUrl: null,
      points: 10,
      order: questions.length,
      sampleAnswer: "",
      gradingRubric: "",
      caseSensitive: false,
      options: initialOptions,
    };

    setQuestions([...questions, newQuestion]);
  };

  // Update Question Field
  const updateQuestion = (index: number, updates: Partial<QuestionItem>) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // Delete Question
  const handleDeleteQuestion = async (index: number) => {
    if (questions.length <= 1) {
      toast.warning("Ujian harus memiliki minimal 1 soal.");
      return;
    }
    const confirmed = await confirm({
      title: "Hapus Butir Soal",
      message: `Apakah Anda yakin ingin menghapus soal #${index + 1}?`,
      confirmText: "Ya, Hapus Soal",
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });
    if (!confirmed) return;

    setQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Soal berhasil dihapus.");
  };

  // Duplicate Question
  const handleDuplicateQuestion = (index: number) => {
    const target = questions[index];
    const duplicated: QuestionItem = {
      ...target,
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: `${target.text} (Salinan)`,
      options: target.options.map((opt) => ({ ...opt })),
      order: questions.length,
    };
    const newList = [...questions];
    newList.splice(index + 1, 0, duplicated);
    setQuestions(newList);
    toast.success("Soal berhasil disalin.");
  };

  // Move Question Order
  const handleMoveQuestion = (index: number, direction: "UP" | "DOWN") => {
    if (direction === "UP" && index === 0) return;
    if (direction === "DOWN" && index === questions.length - 1) return;

    const targetIdx = direction === "UP" ? index - 1 : index + 1;
    const newList = [...questions];
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;
    setQuestions(newList);
  };

  // Option Handlers
  const handleAddOption = (qIdx: number) => {
    const q = questions[qIdx];
    const letter = String.fromCharCode(65 + q.options.length);
    const newOptions = [...q.options, { text: `Pilihan ${letter}`, isCorrect: false }];
    updateQuestion(qIdx, { options: newOptions });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    if (q.options.length <= 2) {
      toast.warning("Pilihan minimal harus berjumlah 2 opsi.");
      return;
    }
    const newOptions = q.options.filter((_, i) => i !== optIdx);
    updateQuestion(qIdx, { options: newOptions });
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, text: string) => {
    const q = questions[qIdx];
    const newOptions = [...q.options];
    newOptions[optIdx].text = text;
    updateQuestion(qIdx, { options: newOptions });
  };

  const handleOptionCorrectToggle = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    const newOptions = [...q.options];

    if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
      // Only one correct answer
      newOptions.forEach((opt, idx) => {
        opt.isCorrect = idx === optIdx;
      });
    } else if (q.type === "CHECKBOXES") {
      // Multiple correct answers
      newOptions[optIdx].isCorrect = !newOptions[optIdx].isCorrect;
    }

    updateQuestion(qIdx, { options: newOptions });
  };

  // Image Upload with Auto-WebP Compression
  const handleUploadImage = async (qIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImgIdx(qIdx);
      toast.info("Mengompresi gambar ke format WebP...");

      // Compress to WebP
      const compressedWebP = await compressImageToWebP(file, 1280, 0.82);

      const formData = new FormData();
      formData.append("file", compressedWebP);

      const res = await fetch("/api/admin/exams/upload-image", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.success && json.url) {
        updateQuestion(qIdx, { imageUrl: json.url });
        toast.success("Gambar soal WebP berhasil diunggah!");
      } else {
        toast.error(json.error || "Gagal mengunggah gambar.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengompresi atau mengunggah gambar.");
    } finally {
      setUploadingImgIdx(null);
      e.target.value = "";
    }
  };

  // Export Questions to JSON
  const handleExportJSON = () => {
    const payload = {
      title,
      description,
      durationMinutes,
      questions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soal_${title.toLowerCase().replace(/\s+/g, "_") || "ujian"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File backup soal JSON berhasil diunduh.");
  };

  // Import Questions from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
          if (parsed.title && !title) setTitle(parsed.title);
          if (parsed.description && !description) setDescription(parsed.description);
          if (parsed.durationMinutes) setDurationMinutes(Number(parsed.durationMinutes));
          toast.success(`Berhasil mengimpor ${parsed.questions.length} butir soal!`);
        } else if (Array.isArray(parsed)) {
          setQuestions(parsed);
          toast.success(`Berhasil mengimpor ${parsed.length} butir soal!`);
        } else {
          toast.error("Format file JSON soal tidak sesuai.");
        }
      } catch (err) {
        toast.error("Gagal membaca file JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Save Exam
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("Judul ujian wajib diisi!");
      return;
    }

    if (questions.length === 0) {
      toast.warning("Ujian harus memiliki minimal 1 butir soal.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        durationMinutes: Number(durationMinutes) || 30,
        enableFullscreenLock,
        enableTabSwitchDetect,
        maxStrikes: Number(maxStrikes) || 3,
        supervisorPin: supervisorPin.trim() || "123456",
        shuffleQuestions,
        shuffleOptions,
        examToken: examToken.trim() ? examToken.trim().toUpperCase() : null,
        showScoreImmediately,
        showDiscussion,
        questions: questions.map((q, idx) => ({
          ...q,
          order: idx,
          points: Number(q.points) || 10,
        })),
      };

      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Modul ujian berhasil dibuat!");
        router.push("/admin/exams");
      } else {
        toast.error(json.error || "Gagal membuat modul ujian.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan modul ujian.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveExam} className="space-y-8 pb-32 max-w-5xl mx-auto">
      {/* Top Floating Action Bar */}
      <div className="sticky top-4 z-40 p-4 rounded-3xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/exams"
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
              <span>Buat Modul Ujian CBT Baru</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-400/30">
                ExamBro Safe
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {questions.length} Soal • Total Skor: <strong className="text-emerald-400 font-mono">{totalPoints} Poin</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import / Export JSON */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Backup soal ke file JSON"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>

          <label className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Impor JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          {/* Submit Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Modul Ujian</span>
          </button>
        </div>
      </div>

      {/* 1. Exam Configuration Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-xs">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Informasi & Pengaturan Ujian</h2>
            <p className="text-xs text-slate-500">Atur judul, durasi, dan proteksi anti-cheat ujian CBT.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700">
              Judul Ujian <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Ujian Tengah Semester Bahasa Inggris - Kelas X"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700">Deskripsi / Petunjuk Pengerjaan</label>
            <textarea
              rows={2}
              placeholder="Tuliskan petunjuk umum ujian untuk siswa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Durasi Pengerjaan (Menit)</span>
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 30))}
              className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>PIN Buka Kunci Pengawas (Supervisor PIN)</span>
            </label>
            <input
              type="text"
              value={supervisorPin}
              onChange={(e) => setSupervisorPin(e.target.value)}
              placeholder="123456"
              className="w-full px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span>Token Masuk Ujian (Opsional / Token 5-Huruf)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Kosongkan jika siswa bisa langsung mulai tanpa token
              </span>
            </label>
            <input
              type="text"
              value={examToken}
              onChange={(e) => setExamToken(e.target.value.toUpperCase())}
              placeholder="Contoh: VELO1 (Diberikan guru di kelas saat jam ujian)"
              className="w-full uppercase px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono font-bold tracking-wider"
            />
          </div>
        </div>

        {/* Security Anti-Cheat ExamBro Toggles */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            <span>Konfigurasi Keamanan Anti-Kecurangan ExamBro</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={enableFullscreenLock}
                onChange={(e) => setEnableFullscreenLock(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Kunci Layar Penuh</span>
                <span className="text-[11px] text-slate-500">Wajib fullscreen saat ujian</span>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={enableTabSwitchDetect}
                onChange={(e) => setEnableTabSwitchDetect(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Deteksi Pindah Tab</span>
                <span className="text-[11px] text-slate-500">Deteksi buka Google / aplikasi lain</span>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={enableCameraProctor}
                onChange={(e) => setEnableCameraProctor(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">AI Camera Proctoring</span>
                <span className="text-[11px] text-slate-500">Pengawasan kamera real-time</span>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Acak Urutan Soal</span>
                <span className="text-[11px] text-slate-500">Urutan soal berbeda tiap siswa</span>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Acak Opsi Jawaban</span>
                <span className="text-[11px] text-slate-500">Urutan A-B-C-D diacak</span>
              </div>
            </label>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Maksimal Pelanggaran</span>
                <span className="text-[11px] text-slate-500">Siswa terkunci jika mencapai batas</span>
              </div>
              <select
                value={maxStrikes}
                onChange={(e) => setMaxStrikes(parseInt(e.target.value) || 3)}
                className="px-2.5 py-1 text-xs rounded-xl bg-white border border-slate-300 font-bold text-slate-900"
              >
                <option value={1}>1 Strike</option>
                <option value={2}>2 Strikes</option>
                <option value={3}>3 Strikes</option>
                <option value={5}>5 Strikes</option>
              </select>
            </div>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={showScoreImmediately}
                onChange={(e) => setShowScoreImmediately(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Tampilkan Nilai Langsung</span>
                <span className="text-[11px] text-slate-500">Skor muncul seketika setelah kirim</span>
              </div>
            </label>

            <label className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={showDiscussion}
                onChange={(e) => setShowDiscussion(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Tampilkan Pembahasan</span>
                <span className="text-[11px] text-slate-500">Bolehkan siswa lihat kunci/pembahasan</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Question Builder Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Daftar Butir Soal Ujian ({questions.length} Soal)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Buat dan kelola butir soal dengan dukungan 5 tipe soal & gambar terkompresi WebP.
            </p>
          </div>

          {/* Add Question Dropdown Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddQuestion("SINGLE_CHOICE")}
              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pilihan Ganda</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestion("CHECKBOXES")}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Multi-Pilih</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestion("TRUE_FALSE")}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Benar/Salah</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestion("SHORT_ANSWER")}
              className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Isian Singkat</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestion("ESSAY")}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Uraian / Essay</span>
            </button>
          </div>
        </div>

        {/* Questions Cards List */}
        <div className="space-y-6">
          {questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5 transition-all hover:border-blue-300"
            >
              {/* Question Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                    {qIdx + 1}
                  </span>

                  <select
                    value={q.type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      let initialOptions = q.options;
                      if (newType === "TRUE_FALSE") {
                        initialOptions = [
                          { text: "Benar", isCorrect: true },
                          { text: "Salah", isCorrect: false },
                        ];
                      } else if (
                        (newType === "SINGLE_CHOICE" || newType === "CHECKBOXES") &&
                        q.options.length < 2
                      ) {
                        initialOptions = [
                          { text: "Pilihan A", isCorrect: true },
                          { text: "Pilihan B", isCorrect: false },
                        ];
                      }
                      updateQuestion(qIdx, { type: newType, options: initialOptions });
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 border border-slate-200 text-slate-800"
                  >
                    <option value="SINGLE_CHOICE">Pilihan Ganda (1 Jawaban)</option>
                    <option value="CHECKBOXES">Pilihan Ganda Kompleks (Multi-Pilih)</option>
                    <option value="TRUE_FALSE">Benar / Salah</option>
                    <option value="SHORT_ANSWER">Isian Singkat</option>
                    <option value="ESSAY">Uraian / Essay</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Points Input */}
                  <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                    <span className="text-slate-500 font-semibold">Poin:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(qIdx, { points: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-12 text-center font-bold text-slate-900 bg-transparent outline-none"
                    />
                  </div>

                  {/* Move Order */}
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, "UP")}
                    disabled={qIdx === 0}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                    title="Pindah ke Atas"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, "DOWN")}
                    disabled={qIdx === questions.length - 1}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                    title="Pindah ke Bawah"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateQuestion(qIdx)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-blue-600 cursor-pointer"
                    title="Duplikasi Soal"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIdx)}
                    className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-600 cursor-pointer"
                    title="Hapus Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Teks Soal / Pertanyaan:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik teks butir soal di sini..."
                  value={q.text}
                  onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                  className="w-full p-3.5 text-xs rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 leading-relaxed font-medium"
                />
              </div>

              {/* Question Image Attachment (WebP Compressed) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gambar Ilustrasi Soal (Otomatis Kompresi ke WebP):</span>
                  </label>
                  {q.imageUrl && (
                    <button
                      type="button"
                      onClick={() => updateQuestion(qIdx, { imageUrl: null })}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Hapus Gambar
                    </button>
                  )}
                </div>

                {q.imageUrl ? (
                  <div className="relative max-w-sm rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 p-2">
                    <img
                      src={q.imageUrl}
                      alt={`Gambar Soal #${qIdx + 1}`}
                      className="w-full max-h-52 object-contain rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{q.imageUrl}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200">
                      {uploadingImgIdx === qIdx ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {uploadingImgIdx === qIdx ? "Mengompresi..." : "Upload Gambar (WebP)"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImgIdx === qIdx}
                        onChange={(e) => handleUploadImage(qIdx, e)}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="url"
                      placeholder="Atau tempel link URL gambar eksternal (https://...)"
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          updateQuestion(qIdx, { imageUrl: e.target.value.trim() });
                          e.target.value = "";
                        }
                      }}
                      className="flex-1 min-w-[200px] px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Question Type Options / Answers */}
              {(q.type === "SINGLE_CHOICE" || q.type === "CHECKBOXES" || q.type === "TRUE_FALSE") && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {q.type === "SINGLE_CHOICE"
                        ? "Pilihan Jawaban (Pilih 1 Kunci Benar):"
                        : q.type === "CHECKBOXES"
                        ? "Pilihan Jawaban (Bisa Pilih > 1 Kunci Benar):"
                        : "Pilihan Benar / Salah:"}
                    </span>

                    {q.type !== "TRUE_FALSE" && (
                      <button
                        type="button"
                        onClick={() => handleAddOption(qIdx)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Tambah Pilihan
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                            opt.isCorrect
                              ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/10"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          {/* Radio / Checkbox for Correct Answer */}
                          <button
                            type="button"
                            onClick={() => handleOptionCorrectToggle(qIdx, optIdx)}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer ${
                              opt.isCorrect
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white border border-slate-300 text-slate-600 hover:border-emerald-400"
                            }`}
                            title={opt.isCorrect ? "Kunci Jawaban Benar" : "Tandai sebagai Kunci Jawaban"}
                          >
                            {opt.isCorrect ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span>{letter}</span>
                            )}
                          </button>

                          {/* Option Text Input */}
                          <input
                            type="text"
                            required
                            disabled={q.type === "TRUE_FALSE"}
                            value={opt.text}
                            onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                            placeholder={`Teks pilihan ${letter}...`}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                          />

                          {/* Delete Option */}
                          {q.type !== "TRUE_FALSE" && q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIdx, optIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Pilihan"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Short Answer Configuration */}
              {q.type === "SHORT_ANSWER" && (
                <div className="space-y-3 p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-purple-900">
                      Kunci Jawaban Isian yang Diterima:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Photosynthesis / Fotosintesis"
                      value={q.sampleAnswer || ""}
                      onChange={(e) => updateQuestion(qIdx, { sampleAnswer: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-purple-200 text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-[10px] text-purple-700">
                      Pisahkan dengan garis miring (/) jika terdapat beberapa variasi jawaban yang valid.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-purple-900 font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(q.caseSensitive)}
                      onChange={(e) => updateQuestion(qIdx, { caseSensitive: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Peka Huruf Besar/Kecil (Case Sensitive)</span>
                  </label>
                </div>
              )}

              {/* Essay Configuration */}
              {q.type === "ESSAY" && (
                <div className="space-y-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-900">
                      Rubrik Penilaian & Kata Kunci (Untuk Guru & Koreksi AI):
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh kata kunci yang harus ada: proses klorofil, sinar matahari, karbon dioksida..."
                      value={q.gradingRubric || ""}
                      onChange={(e) => updateQuestion(qIdx, { gradingRubric: e.target.value })}
                      className="w-full p-3 text-xs rounded-xl bg-white border border-amber-200 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-900">Contoh Jawaban Ideal:</label>
                    <textarea
                      rows={2}
                      placeholder="Tuliskan contoh jawaban uraian yang sempurna..."
                      value={q.sampleAnswer || ""}
                      onChange={(e) => updateQuestion(qIdx, { sampleAnswer: e.target.value })}
                      className="w-full p-3 text-xs rounded-xl bg-white border border-amber-200 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Sticky Action Buttons */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-md flex items-center justify-between gap-4">
        <Link
          href="/admin/exams"
          className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          Batal
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Simpan & Terbitkan Modul Ujian</span>
        </button>
      </div>
    </form>
  );
}
