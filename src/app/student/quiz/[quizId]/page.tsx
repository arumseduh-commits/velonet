"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
  Flag,
  Maximize,
  Minimize,
  Grid,
  Sparkles,
  Trophy,
  HelpCircle,
  CheckSquare,
  Square,
  FileText,
  AlignLeft,
  Eye,
  EyeOff,
  RotateCcw,
  Edit,
  Zap,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useExamSecurity } from "@/hooks/useExamSecurity";
import FaceProctorWidget from "@/components/exam/FaceProctorWidget";
import ExamPreCheckModal from "@/components/exam/ExamPreCheckModal";
import ExamLockedScreen from "@/components/exam/ExamLockedScreen";

interface StudentAnswerState {
  optionId?: string;
  selectedOptionIds?: string[];
  textResponse?: string;
}

export default function QuizTakingPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { confirm, toast } = useDialog();

  // Core Data States
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showAnswerKeys, setShowAnswerKeys] = useState(false);
  const [examTokenInput, setExamTokenInput] = useState("");

  // Exam Interaction States
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: StudentAnswerState }>({});
  const [flagged, setFlagged] = useState<{ [qIndex: number]: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Security & Proctoring States
  const [strikeCount, setStrikeCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [showQuestionPalette, setShowQuestionPalette] = useState(false);

  // Timer States
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(30 * 60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load & LocalStorage Recovery
  useEffect(() => {
    fetchQuizData();
  }, [quizId]);

  const fetchQuizData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quiz/${quizId}`);
      const json = await res.json();

      if (json.success && json.data) {
        const qData = json.data.quiz;
        const att = json.data.attempt;
        const isPrev = Boolean(json.data.isPreview);
        setQuiz(qData);
        setAttempt(att);
        setIsPreview(isPrev);

        // Try local storage draft recovery
        let localDraft: any = null;
        try {
          const stored = localStorage.getItem(`velonet_cbt_draft_${quizId}`);
          if (stored) localDraft = JSON.parse(stored);
        } catch (e) {}

        if (att && !isPrev) {
          setStrikeCount(att.strikeCount || 0);
          if (att.status === "LOCKED") {
            setIsLocked(true);
            setHasStarted(true);
          } else if (att.status === "SUBMITTED" || att.status === "GRADED" || att.status === "DISQUALIFIED") {
            setIsCompleted(true);
            setResultData(att);
          } else if (att.status === "IN_PROGRESS") {
            setHasStarted(true);
            if (localDraft) {
              setAnswers(localDraft);
            } else if (att.answers && typeof att.answers === "object") {
              setAnswers(att.answers);
            }
          }
        } else {
          // New attempt needed or Admin preview -> show precheck modal
          setShowPreCheck(true);
          if (localDraft) setAnswers(localDraft);
        }

        // Initialize duration timer
        const totalSecs = (qData.durationMinutes || 30) * 60;
        setTimeLeftSeconds(totalSecs);
      } else {
        toast.error("Kuis tidak ditemukan atau tidak tersedia.");
      }
    } catch (err) {
      toast.error("Gagal memuat data kuis.");
    } finally {
      setLoading(false);
    }
  };

  // Persist draft to local storage on change
  useEffect(() => {
    if (hasStarted && Object.keys(answers).length > 0) {
      try {
        localStorage.setItem(`velonet_cbt_draft_${quizId}`, JSON.stringify(answers));
      } catch (e) {}
    }
  }, [answers, hasStarted, quizId]);

  // 2. Violation Handler (Triggered by Fullscreen exit, Tab switch, Face anomality, Devtools)
  const handleViolation = useCallback(
    async (type: string, description: string) => {
      if (isCompleted || isLocked || !hasStarted) return;

      try {
        const res = await fetch(`/api/quiz/${quizId}/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, description }),
        });

        const json = await res.json();
        if (json.success) {
          const newStrikes = json.data.strikeCount;
          setStrikeCount(newStrikes);

          if (json.data.isLocked) {
            setIsLocked(true);
            toast.error("Batas pelanggaran terlampaui. Ujian Anda telah dikunci!");
          } else {
            toast.warning(`Peringatan Pelanggaran (${newStrikes}/${quiz?.maxStrikes || 3}): ${description}`);
          }
        }
      } catch (err) {
        console.error("Violation logging failed:", err);
      }
    },
    [isCompleted, isLocked, hasStarted, quizId, quiz?.maxStrikes, toast]
  );

  // 3. Exam Security Hook (Fullscreen & Tab Switch & Key Lock)
  const { isFullscreen, enterFullscreen } = useExamSecurity({
    enabled: hasStarted && !isLocked && !isCompleted,
    enableFullscreenLock: quiz?.enableFullscreenLock ?? true,
    enableTabSwitchDetect: quiz?.enableTabSwitchDetect ?? true,
    enableDevToolsDetect: true,
    onViolation: handleViolation,
  });

  // 4. Timer Countdown & Auto-Submit on Timeout
  useEffect(() => {
    if (!hasStarted || isLocked || isCompleted) return;

    timerRef.current = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, isLocked, isCompleted]);

  const handleAutoSubmitOnTimeout = async () => {
    toast.info("Waktu ujian telah habis. Jawaban Anda sedang dikumpulkan secara otomatis...");
    await executeSubmit();
  };

  // 5. Start Exam Process
  const handleStartExam = async () => {
    try {
      if (quiz?.enableFullscreenLock && !isPreview) {
        await enterFullscreen();
      }

      const res = await fetch(`/api/quiz/${quizId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: examTokenInput }),
      });

      const json = await res.json();
      if (json.success) {
        setShowPreCheck(false);
        setHasStarted(true);
        if (isPreview) {
          toast.success("Mode pratinjau aktif. Anda dapat menguji soal dan fitur keamanan pengawas.");
        } else {
          toast.success("Ujian dimulai. Harap patuhi seluruh tata tertib VeloExambro.");
        }
      } else {
        toast.error(json.error || "Gagal memulai sesi ujian.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memulai ujian.");
    }
  };

  // 6. Multi-Format Answer Handlers
  const handleSelectSingleChoice = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { optionId },
    }));
  };

  const handleToggleCheckbox = (questionId: string, optionId: string) => {
    const current = answers[questionId]?.selectedOptionIds || [];
    const exists = current.includes(optionId);
    const updated = exists ? current.filter((id) => id !== optionId) : [...current, optionId];

    setAnswers((prev) => ({
      ...prev,
      [questionId]: { selectedOptionIds: updated },
    }));
  };

  const handleTextResponseChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { textResponse: text },
    }));
  };

  // 7. Toggle Flag / Ragu-ragu
  const toggleFlag = (index: number) => {
    setFlagged((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // 8. Submit Final Confirmation
  const handleSubmitConfirmation = async () => {
    const answeredCount = Object.keys(answers).filter((k) => {
      const a = answers[k];
      return a.optionId || (a.selectedOptionIds && a.selectedOptionIds.length > 0) || (a.textResponse && a.textResponse.trim().length > 0);
    }).length;

    const totalCount = quiz.questions.length;

    if (answeredCount < totalCount) {
      const ok = await confirm({
        title: "Perhatian: Soal Belum Lengkap",
        message: `Anda baru menjawab ${answeredCount} dari ${totalCount} soal. Yakin ingin mengumpulkan sekarang?`,
        variant: "warning",
        confirmText: "Kumpulkan Saja",
        cancelText: "Periksa Lagi",
        icon: "warning",
      });
      if (ok) executeSubmit();
    } else {
      const ok = await confirm({
        title: "Konfirmasi Pengumpulan Ujian",
        message: "Apakah Anda yakin ingin menyelesaikan dan mengumpulkan ujian ini?",
        variant: "info",
        confirmText: "Ya, Selesaikan Ujian",
        cancelText: "Batal",
        icon: "shield",
      });
      if (ok) executeSubmit();
    }
  };

  // 9. Execute Final Submit
  const executeSubmit = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = quiz.questions.map((q: any) => {
        const a = answers[q.id] || {};
        return {
          questionId: q.id,
          optionId: a.optionId || null,
          selectedOptionIds: a.selectedOptionIds || [],
          textResponse: a.textResponse || null,
        };
      });

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: formattedAnswers }),
      });

      const json = await res.json();
      if (json.success) {
        try {
          localStorage.removeItem(`velonet_cbt_draft_${quizId}`);
        } catch (e) {}

        setIsCompleted(true);
        setResultData(json.data);
        toast.success("Ujian berhasil dikumpulkan!");
      } else {
        toast.error(json.error || "Gagal mengumpulkan kuis.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan server saat mengumpulkan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Format time display (MM:SS)
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // -------------------------------------------------------------
  // RENDER STATES
  // -------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-300">Menyiapkan Sistem VeloExambro...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-700">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Kuis Tidak Tersedia</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
          Kuis yang Anda tuju tidak ditemukan atau belum dipublikasikan oleh Mentor.
        </p>
        <button
          onClick={() => router.push("/student/learning")}
          className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-md"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // Completed State View (Result & Gamification)
  if (isCompleted) {
    const score = resultData?.score ?? 0;
    const totalScore = resultData?.totalScore ?? quiz.questions.reduce((acc: number, q: any) => acc + q.points, 0);
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const isPassed = percentage >= 70;
    const hasPendingEssays = resultData?.hasPendingEssays;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-900">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-6">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg ${
              isPassed ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-amber-500 text-white shadow-amber-500/30"
            }`}
          >
            {isPassed ? <Trophy className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
          </div>

          <div>
            <span
              className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full ${
                hasPendingEssays
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : isPassed
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {hasPendingEssays ? "Terkumpul (Menunggu Review Essay)" : isPassed ? "Lulus dengan Baik" : "Hasil Ujian"}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">{quiz.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {hasPendingEssays
                ? "Soal pilihan ganda dinilai otomatis. Bagian uraian sedang ditinjau oleh Guru & AI."
                : "Ujian Anda telah selesai dan dinilai secara otomatis."}
            </p>
          </div>

          {/* Score Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-around">
            <div>
              <span className="text-xs text-slate-500 font-medium">Nilai Diperoleh</span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {score} <span className="text-xs text-slate-400 font-normal">/ {totalScore}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Persentase</span>
              <div className={`text-3xl font-black mt-0.5 ${isPassed ? "text-emerald-600" : "text-amber-600"}`}>
                {percentage}%
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(isPreview ? `/admin/exams/${quizId}/edit` : "/student/exams")}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 transition-all"
          >
            <span>{isPreview ? "Kembali ke Editor Ujian Admin" : "Kembali ke Pusat Ujian CBT"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Pre-Check Modal
  if (showPreCheck) {
    return (
      <ExamPreCheckModal
        quizTitle={quiz.title}
        durationMinutes={quiz.durationMinutes || 30}
        maxStrikes={quiz.maxStrikes || 3}
        enableCamera={quiz.enableCameraProctor ?? true}
        enableFullscreen={quiz.enableFullscreenLock ?? true}
        hasExamToken={quiz.hasExamToken}
        examTokenInput={examTokenInput}
        onTokenChange={setExamTokenInput}
        isPreview={isPreview}
        onStartExam={handleStartExam}
      />
    );
  }

  // Locked Screen
  if (isLocked) {
    return (
      <ExamLockedScreen
        quizId={quizId}
        strikeCount={strikeCount}
        maxStrikes={quiz.maxStrikes || 3}
        onUnlocked={() => {
          setIsLocked(false);
          setStrikeCount(0);
          if (quiz.enableFullscreenLock && !isPreview) {
            enterFullscreen();
          }
        }}
      />
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const isLastQuestion = currentIndex === quiz.questions.length - 1;
  const answeredTotal = Object.keys(answers).filter((k) => {
    const a = answers[k];
    return a.optionId || (a.selectedOptionIds && a.selectedOptionIds.length > 0) || (a.textResponse && a.textResponse.trim().length > 0);
  }).length;

  const qType = currentQuestion?.type || "SINGLE_CHOICE";
  const currentAnswer = answers[currentQuestion?.id] || {};

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none relative">
      {/* 0. ADMIN PREVIEW TOP BANNER */}
      {isPreview && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between gap-3 shadow-md z-40">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 font-extrabold text-[10px]">
              MODE PRATINJAU GURU
            </span>
            <span>
              Anda sedang menguji tampilan soal siswa & sistem keamanan CBT. Data hasil ujian tidak akan masuk ke rekap nilai.
            </span>
          </div>
          <Link
            href={`/admin/exams/${quizId}/edit`}
            className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-white text-[11px] font-bold shrink-0 transition-colors"
          >
            Edit Soal Ini ↗
          </Link>
        </div>
      )}

      {/* 1. TOP SECURE APP BAR */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Quiz Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                  VeloExambro CBT
                </span>
                {isPreview && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                    Pratinjau
                  </span>
                )}
              </div>
              <h1 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                {quiz.title}
              </h1>
            </div>
          </div>

          {/* Center/Right: Timer, Strikes, Palette Toggle */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Timer Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold shadow-xs transition-colors ${
                timeLeftSeconds <= 300
                  ? "bg-rose-950/80 border-rose-600/80 text-rose-300 animate-pulse"
                  : timeLeftSeconds <= 600
                  ? "bg-amber-950/80 border-amber-600/80 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-blue-400"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>

            {/* Strike Counter Badge */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold ${
                strikeCount === 0
                  ? "bg-slate-800/80 border-slate-700 text-slate-300"
                  : strikeCount >= (quiz.maxStrikes || 3) - 1
                  ? "bg-rose-950/80 border-rose-600 text-rose-400"
                  : "bg-amber-950/80 border-amber-600 text-amber-300"
              }`}
              title="Jumlah Peringatan Pelanggaran"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {strikeCount}/{quiz.maxStrikes || 3} Strike
              </span>
            </div>

            {/* Question Palette Toggle */}
            <button
              onClick={() => setShowQuestionPalette(!showQuestionPalette)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Daftar Soal"
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">
                {answeredTotal}/{quiz.questions.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN EXAM WORKSPACE */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-28">
        {/* Question Area (8 Cols on Desktop) */}
        <section className="lg:col-span-8 flex flex-col space-y-6">
          {/* Question Card */}
          <div className="bg-slate-800/90 rounded-3xl p-5 sm:p-7 border border-slate-700/80 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              {/* Question Header Meta */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {currentIndex + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    dari {quiz.questions.length} Soal
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-300 bg-slate-700/70 px-2 py-0.5 rounded-md">
                    {qType}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40">
                    {currentQuestion.points} Poin
                  </span>
                  <button
                    onClick={() => toggleFlag(currentIndex)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                      flagged[currentIndex]
                        ? "bg-amber-950/90 border-amber-500 text-amber-300"
                        : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{flagged[currentIndex] ? "Ragu-ragu" : "Tandai Ragu"}</span>
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed whitespace-pre-line">
                {currentQuestion.text}
              </div>

              {/* Question Image Attachment (if any) */}
              {currentQuestion.imageUrl && (
                <div className="my-4 max-w-lg rounded-2xl overflow-hidden border border-slate-700 bg-slate-900/60 p-2 shadow-inner">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Gambar Soal #${currentIndex + 1}`}
                    className="w-full max-h-72 object-contain rounded-xl mx-auto"
                  />
                </div>
              )}

              {/* DYNAMIC QUESTION INPUT BASED ON TYPE */}
              <div className="mt-6">
                {/* 1. SINGLE CHOICE */}
                {qType === "SINGLE_CHOICE" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt: any, optIdx: number) => {
                      const isSelected = currentAnswer.optionId === opt.id;
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrectKey = isPreview && showAnswerKeys && opt.isCorrect;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectSingleChoice(currentQuestion.id, opt.id)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer text-sm relative ${
                            isCorrectKey
                              ? "bg-emerald-950/40 border-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-md"
                              : isSelected
                              ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500/50 shadow-md"
                              : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              isCorrectKey
                                ? "bg-emerald-600 text-white"
                                : isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 border border-slate-700 text-slate-400"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 leading-snug">{opt.text}</span>
                          {isCorrectKey && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> KUNCI BENAR
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. CHECKBOXES (Multi-Select) */}
                {qType === "CHECKBOXES" && (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-300/80 mb-2 italic">
                      * Pilih satu atau lebih jawaban yang benar.
                    </p>
                    {currentQuestion.options?.map((opt: any, optIdx: number) => {
                      const isSelected = (currentAnswer.selectedOptionIds || []).includes(opt.id);
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrectKey = isPreview && showAnswerKeys && opt.isCorrect;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleToggleCheckbox(currentQuestion.id, opt.id)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer text-sm ${
                            isCorrectKey
                              ? "bg-emerald-950/40 border-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-md"
                              : isSelected
                              ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500/50 shadow-md"
                              : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              isCorrectKey
                                ? "bg-emerald-600 text-white"
                                : isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 border border-slate-700 text-slate-400"
                            }`}
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : letter}
                          </div>
                          <span className="flex-1 leading-snug">{opt.text}</span>
                          {isCorrectKey && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> KUNCI BENAR
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. TRUE / FALSE */}
                {qType === "TRUE_FALSE" && (
                  <div className="grid grid-cols-2 gap-4">
                    {currentQuestion.options?.map((opt: any) => {
                      const isSelected = currentAnswer.optionId === opt.id;
                      const isTrue = opt.text.toUpperCase() === "BENAR";
                      const isCorrectKey = isPreview && showAnswerKeys && opt.isCorrect;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectSingleChoice(currentQuestion.id, opt.id)}
                          className={`p-6 rounded-3xl border text-center transition-all cursor-pointer font-black text-lg sm:text-xl flex flex-col items-center justify-center gap-2 relative ${
                            isCorrectKey
                              ? "bg-emerald-600/40 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400 shadow-lg"
                              : isSelected
                              ? isTrue
                                ? "bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/50 shadow-lg"
                                : "bg-rose-600/30 border-rose-500 text-rose-300 ring-2 ring-rose-500/50 shadow-lg"
                              : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:bg-slate-700/50"
                          }`}
                        >
                          <span>{opt.text}</span>
                          {isCorrectKey && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-extrabold">
                              ✓ KUNCI BENAR
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. SHORT ANSWER */}
                {qType === "SHORT_ANSWER" && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 block">
                      Tuliskan Jawaban Singkat Anda:
                    </label>
                    <input
                      type="text"
                      value={currentAnswer.textResponse || ""}
                      onChange={(e) => handleTextResponseChange(currentQuestion.id, e.target.value)}
                      placeholder="Ketik jawaban di sini..."
                      className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                    />
                    {isPreview && showAnswerKeys && currentQuestion.sampleAnswer && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs space-y-1">
                        <strong className="text-emerald-400 block font-bold">Kunci Jawaban Contoh:</strong>
                        <p>{currentQuestion.sampleAnswer}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. ESSAY / URAIAN */}
                {qType === "ESSAY" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 block">
                        Tuliskan Uraian Lengkap Anda:
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {(currentAnswer.textResponse || "").trim().split(/\s+/).filter(Boolean).length} Kata
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={currentAnswer.textResponse || ""}
                      onChange={(e) => handleTextResponseChange(currentQuestion.id, e.target.value)}
                      placeholder="Ketik uraian jawaban secara jelas dan lengkap..."
                      className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-normal text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                    />
                    {isPreview && showAnswerKeys && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs space-y-2">
                        {currentQuestion.sampleAnswer && (
                          <div>
                            <strong className="text-emerald-400 block font-bold">Contoh Uraian Jawaban Ideal:</strong>
                            <p className="mt-0.5 text-slate-200">{currentQuestion.sampleAnswer}</p>
                          </div>
                        )}
                        {currentQuestion.gradingRubric && (
                          <div>
                            <strong className="text-emerald-400 block font-bold">Rubrik Penilaian AI / Guru:</strong>
                            <p className="mt-0.5 text-slate-200">{currentQuestion.gradingRubric}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Nav inside card */}
            <div className="pt-6 mt-8 border-t border-slate-700/60 flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {isLastQuestion ? (
                <button
                  onClick={handleSubmitConfirmation}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/25 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? "Mengumpulkan..." : "Kumpulkan Ujian"}</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex((p) => Math.min(quiz.questions.length - 1, p + 1))}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 transition-all"
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Sidebar Question Palette (Desktop 4 Cols, or Mobile Drawer) */}
        <aside
          className={`lg:col-span-4 ${
            showQuestionPalette
              ? "fixed inset-x-0 bottom-0 top-16 z-40 bg-slate-900/95 backdrop-blur-md p-6 overflow-y-auto block lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
              : "hidden lg:block"
          }`}
        >
          <div className="bg-slate-800/90 rounded-3xl p-5 border border-slate-700/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Navigasi Soal
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {answeredTotal} / {quiz.questions.length} Terjawab
              </span>
            </div>

            {/* Color Legend */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-blue-600"></span>
                <span>Dijawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-amber-500"></span>
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-slate-700"></span>
                <span>Belum</span>
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div className="grid grid-cols-5 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {quiz.questions.map((q: any, idx: number) => {
                const a = answers[q.id];
                const isAnswered =
                  a &&
                  (a.optionId ||
                    (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
                    (a.textResponse && a.textResponse.trim().length > 0));

                const isFlagged = !!flagged[idx];
                const isCurrent = currentIndex === idx;

                let btnClass = "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500";
                if (isFlagged) {
                  btnClass = "bg-amber-600/30 border-amber-500 text-amber-300 font-bold";
                } else if (isAnswered) {
                  btnClass = "bg-blue-600 border-blue-500 text-white font-bold";
                }

                if (isCurrent) {
                  btnClass += " ring-2 ring-white ring-offset-2 ring-offset-slate-900";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowQuestionPalette(false);
                    }}
                    className={`h-10 rounded-xl border text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Action inside palette */}
            <div className="pt-3 border-t border-slate-700/60">
              <button
                onClick={handleSubmitConfirmation}
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/25 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kumpulkan Ujian Sekarang</span>
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* 3. AI FACE PROCTORING WIDGET (PIP Thumbnail at Bottom Right) */}
      <FaceProctorWidget
        enabled={quiz.enableCameraProctor ?? true}
        onViolation={handleViolation}
      />

      {/* 4. FLOATING SUPERVISOR TOOLBAR (ADMIN PREVIEW ONLY) */}
      {isPreview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4">
          <div className="p-3 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              <span className="text-xs font-bold text-slate-300 hidden sm:inline">
                Toolbar Pengawas:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Answer Key */}
              <button
                onClick={() => setShowAnswerKeys((p) => !p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  showAnswerKeys
                    ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 shadow-xs"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
              >
                {showAnswerKeys ? (
                  <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{showAnswerKeys ? "Sembunyikan Kunci" : "Intip Kunci Jawaban"}</span>
              </button>

              {/* Reset Draft Answers */}
              <button
                onClick={() => {
                  setAnswers({});
                  try {
                    localStorage.removeItem(`velonet_cbt_draft_${quizId}`);
                  } catch (e) {}
                  toast.info("Draft jawaban uji coba berhasil direset.");
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                <span>Reset Jawaban</span>
              </button>

              {/* Simulate Violation Strike */}
              <button
                onClick={() => handleViolation("SIMULATED_VIOLATION", "Simulasi Pelanggaran Pengawas")}
                className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                <span>Simulasi Strike</span>
              </button>

              {/* Back to Exam Editor */}
              <Link
                href={`/admin/exams/${quizId}/edit`}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition-colors cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editor Soal</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
