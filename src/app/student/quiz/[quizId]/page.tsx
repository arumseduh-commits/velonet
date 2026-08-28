"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useExamSecurity } from "@/hooks/useExamSecurity";
import FaceProctorWidget from "@/components/exam/FaceProctorWidget";
import ExamPreCheckModal from "@/components/exam/ExamPreCheckModal";
import ExamLockedScreen from "@/components/exam/ExamLockedScreen";

export default function QuizTakingPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { confirm, toast } = useDialog();

  // Core Data States
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);

  // Exam Interaction States
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
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

  // 1. Initial Load
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
        setQuiz(qData);
        setAttempt(att);

        if (att) {
          setStrikeCount(att.strikeCount || 0);
          if (att.status === "LOCKED") {
            setIsLocked(true);
            setHasStarted(true);
          } else if (att.status === "SUBMITTED" || att.status === "DISQUALIFIED") {
            setIsCompleted(true);
            setResultData(att);
          } else if (att.status === "IN_PROGRESS") {
            setHasStarted(true);
            if (att.answers && typeof att.answers === "object") {
              setAnswers(att.answers);
            }
          }
        } else {
          // New attempt needed -> show precheck modal
          setShowPreCheck(true);
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
      // Enter fullscreen first
      if (quiz?.enableFullscreenLock) {
        await enterFullscreen();
      }

      const res = await fetch(`/api/quiz/${quizId}/start`, {
        method: "POST",
      });

      const json = await res.json();
      if (json.success) {
        setShowPreCheck(false);
        setHasStarted(true);
        toast.success("Ujian dimulai. Harap patuhi seluruh tata tertib VeloExambro.");
      } else {
        toast.error(json.error || "Gagal memulai sesi ujian.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memulai ujian.");
    }
  };

  // 6. Select Option
  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  // 7. Toggle Flag / Ragu-ragu
  const toggleFlag = (index: number) => {
    setFlagged((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // 8. Submit Final Confirmation
  const handleSubmitConfirmation = async () => {
    const answeredCount = Object.keys(answers).length;
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
      const formattedAnswers = quiz.questions.map((q: any) => ({
        questionId: q.id,
        optionId: answers[q.id] || null,
      }));

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: formattedAnswers }),
      });

      const json = await res.json();
      if (json.success) {
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
    const totalScore = resultData?.totalScore ?? quiz.questions.length * 10;
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const isPassed = percentage >= 70;

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
                isPassed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isPassed ? "Lulus dengan Baik" : "Hasil Ujian"}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">{quiz.title}</h2>
            <p className="text-xs text-slate-500 mt-1">Ujian Anda telah selesai dan dinilai secara otomatis.</p>
          </div>

          {/* Score Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-around">
            <div>
              <span className="text-xs text-slate-500 font-medium">Nilai Akhir</span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">{score} <span className="text-xs text-slate-400 font-normal">/ {totalScore}</span></div>
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
            onClick={() => router.push("/student/learning")}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 transition-all"
          >
            <span>Kembali ke Modul Pembelajaran</span>
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
          if (quiz.enableFullscreenLock) {
            enterFullscreen();
          }
        }}
      />
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const isLastQuestion = currentIndex === quiz.questions.length - 1;
  const answeredTotal = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
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
                  VeloExambro Active
                </span>
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
              <div className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
                {currentQuestion.text}
              </div>

              {/* Options List */}
              <div className="mt-6 space-y-3">
                {currentQuestion.options.map((opt: any, optIdx: number) => {
                  const isSelected = answers[currentQuestion.id] === opt.id;
                  const letter = String.fromCharCode(65 + optIdx); // A, B, C, D...

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer text-sm ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500/50 shadow-md"
                          : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 border border-slate-700 text-slate-400"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 leading-snug">{opt.text}</span>
                    </button>
                  );
                })}
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
                const isAnswered = !!answers[q.id];
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
    </div>
  );
}
