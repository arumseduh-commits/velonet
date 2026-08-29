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
  X,
  BookOpen,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useExamSecurity } from "@/hooks/useExamSecurity";
import FaceProctorWidget from "@/components/exam/FaceProctorWidget";
import ExamPreCheckModal from "@/components/exam/ExamPreCheckModal";
import ExamLockedScreen from "@/components/exam/ExamLockedScreen";
import ExamTutorialModal from "@/components/exam/ExamTutorialModal";
import ExamDiscussionReviewModal from "@/components/exam/ExamDiscussionReviewModal";
import ExamLeaderboardModal from "@/components/exam/ExamLeaderboardModal";

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
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Security & Proctoring States
  const [strikeCount, setStrikeCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [showQuestionPalette, setShowQuestionPalette] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [warningModalData, setWarningModalData] = useState<{
    open: boolean;
    strikeCount: number;
    maxStrikes: number;
    description: string;
  } | null>(null);

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
          if (att.status === "DISQUALIFIED") {
            setIsDisqualified(true);
            setIsCompleted(true);
            setResultData(att);
          } else if (att.status === "LOCKED") {
            setIsLocked(true);
            setHasStarted(true);
          } else if (att.status === "SUBMITTED" || att.status === "GRADED") {
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

          // Check if tutorial seen
          if (typeof window !== "undefined") {
            const hasSeen = localStorage.getItem("velonet_cbt_tutorial_seen");
            if (!hasSeen) {
              setShowTutorialModal(true);
            }
          }
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
    if (hasStarted && Object.keys(answers).length > 0 && !isDisqualified) {
      try {
        localStorage.setItem(`velonet_cbt_draft_${quizId}`, JSON.stringify(answers));
      } catch (e) {}
    }
  }, [answers, hasStarted, isDisqualified, quizId]);

  // 2. Violation Handler (Triggered by Fullscreen exit, Tab switch, Split screen, Devtools)
  const handleViolation = useCallback(
    async (type: string, description: string) => {
      if (isCompleted || isDisqualified || !hasStarted) return;

      try {
        const res = await fetch(`/api/quiz/${quizId}/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, description }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          const newStrikes = json.data.strikeCount;
          setStrikeCount(newStrikes);

          if (json.data.isDisqualified) {
            // Fatal Strike 3: Disqualified permanently (Score 0)
            setIsDisqualified(true);
            setIsCompleted(true);
            setAnswers({});
            try {
              localStorage.removeItem(`velonet_cbt_draft_${quizId}`);
            } catch (e) {}
            setResultData({
              status: "DISQUALIFIED",
              score: 0,
              totalScore: quiz?.questions?.reduce((acc: number, q: any) => acc + (q.points || 0), 0) || 100,
            });
            toast.error("Batas 3x pelanggaran terlampaui. Anda telah DIDISKUALIFIKASI (Nilai 0)!");
          } else if (json.data.isReset) {
            // Strike 1 or 2: Wipe all answers, reset to question #1, timer continues running
            setAnswers({});
            setCurrentIndex(0);
            try {
              localStorage.removeItem(`velonet_cbt_draft_${quizId}`);
            } catch (e) {}

            setWarningModalData({
              open: true,
              strikeCount: newStrikes,
              maxStrikes: json.data.maxStrikes || 3,
              description: description || "Terdeteksi beralih tab browser atau membuka aplikasi lain.",
            });
          }
        }
      } catch (e) {
        console.error("Failed to record violation:", e);
      }
    },
    [isCompleted, isDisqualified, hasStarted, quizId, quiz?.questions, toast]
  );

  // 3. Exam Security Hook (Fullscreen & Tab Switch & Key Lock)
  const { isFullscreen, isIOS, isAndroid, enterFullscreen } = useExamSecurity({
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

  // Background auto-sync progress for Live Proctor Leaderboard
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!hasStarted || isCompleted || isPreview) return;
    if (Object.keys(answers).length === 0) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      fetch(`/api/quiz/${quizId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).catch(() => {});
    }, 1200);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [answers, hasStarted, isCompleted, isPreview, quizId]);

  const handleAutoSubmitOnTimeout = async () => {
    toast.warning("Waktu ujian telah habis! Mengumpulkan jawaban secara otomatis...");
    await doSubmitExam();
  };

  // 5. Start Exam (After pre-check & token verified)
  const handleStartExam = async (token?: string) => {
    try {
      if (!isPreview) {
        const res = await fetch(`/api/quiz/${quizId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examToken: token }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || "Gagal memulai ujian.");
          return;
        }
      }

      setShowPreCheck(false);
      setHasStarted(true);

      if (quiz?.enableFullscreenLock && !isPreview) {
        await enterFullscreen();
      }
      toast.success("Ujian dimulai. Selamat mengerjakan!");
    } catch (e) {
      toast.error("Terjadi kesalahan saat memulai ujian.");
    }
  };

  // 6. Answer selection handlers
  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        optionId,
      },
    }));
  };

  const handleToggleMultipleOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId]?.selectedOptionIds || [];
      const exists = current.includes(optionId);
      const updated = exists ? current.filter((id) => id !== optionId) : [...current, optionId];
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          selectedOptionIds: updated,
        },
      };
    });
  };

  const handleTextResponseChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        textResponse: text,
      },
    }));
  };

  const handleToggleFlag = (index: number) => {
    setFlagged((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // 7. Submit Confirmation Dialog & Execution
  const handleSubmitConfirmation = async () => {
    const totalQuestions = quiz.questions.length;
    const answeredCount = Object.keys(answers).filter((k) => {
      const a = answers[k];
      return (
        a.optionId ||
        (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
        (a.textResponse && a.textResponse.trim().length > 0)
      );
    }).length;

    const unansweredCount = totalQuestions - answeredCount;

    const confirmed = await confirm({
      title: "Kumpulkan Ujian Sekarang?",
      message:
        unansweredCount > 0
          ? `Perhatian: Masih terdapat ${unansweredCount} soal yang belum Anda jawab dari total ${totalQuestions} soal. Apakah Anda yakin ingin mengumpulkan?`
          : `Seluruh ${totalQuestions} soal telah dijawab. Apakah Anda yakin ingin mengakhiri dan mengumpulkan hasil ujian?`,
      confirmText: "Ya, Kumpulkan Ujian",
      cancelText: "Kembali Periksa",
      variant: unansweredCount > 0 ? "warning" : "info",
    });

    if (confirmed) {
      await doSubmitExam();
    }
  };

  const doSubmitExam = async () => {
    setSubmitting(true);
    try {
      if (isPreview) {
        // In preview mode, simulate submit locally
        setIsCompleted(true);
        const totalPoints = quiz.questions.reduce((acc: number, q: any) => acc + (q.points || 0), 0);
        setResultData({
          score: Math.round(totalPoints * 0.85),
          totalScore: totalPoints,
          hasPendingEssays: quiz.questions.some((q: any) => q.type === "ESSAY" || q.type === "SHORT_ANSWER"),
        });
        toast.success("Pratinjau: Ujian berhasil disimulasikan selesai!");
        return;
      }

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          answers,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setIsCompleted(true);
        setResultData(json.data);
        try {
          localStorage.removeItem(`velonet_cbt_draft_${quizId}`);
        } catch (e) {}
        toast.success("Ujian berhasil dikumpulkan!");
      } else {
        toast.error(json.error || "Gagal mengumpulkan jawaban.");
      }
    } catch (err) {
      toast.error("Terjadi gangguan saat mengumpulkan jawaban.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper Timer Formatter
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <BrainCircuit className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
        <span className="text-sm font-semibold text-slate-300">Menyiapkan Ruang Ujian CBT...</span>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-white">Ujian Tidak Tersedia</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Modul ujian yang Anda tuju mungkin telah dihapus atau Anda belum memiliki izin akses.
        </p>
        <button
          onClick={() => router.push("/student/exams")}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
        >
          Kembali ke Pusat Ujian
        </button>
      </div>
    );
  }

  // Fatal Strike 3: Disqualified Screen View (Permanent Red Lockout)
  if (isDisqualified) {
    const totalPossiblePoints =
      quiz?.questions?.reduce((acc: number, q: any) => acc + (q.points || 0), 0) || 100;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="w-20 h-20 rounded-3xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-500 mx-auto animate-pulse shadow-lg shadow-rose-600/20">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-400 border border-rose-700 text-xs font-black uppercase tracking-wider">
              STATUS: DIDISKUALIFIKASI (NILAI 0)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Ujian Ditutup Karena Kecurangan
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Anda telah mencapai batas <b>3 kali pelanggaran</b> (berpindah tab browser, split screen, atau membuka aplikasi lain). Sesi ujian Anda telah dihentikan secara permanen oleh sistem ExamBro.
            </p>
          </div>

          {/* Disqualification Score Box */}
          <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-around">
            <div>
              <span className="text-xs text-rose-300 font-medium">Nilai Akhir</span>
              <div className="text-3xl font-black text-rose-400 mt-0.5">
                0 <span className="text-xs text-rose-300 font-normal">/ {totalPossiblePoints}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-rose-800"></div>
            <div>
              <span className="text-xs text-rose-300 font-medium">Total Pelanggaran</span>
              <div className="text-3xl font-black text-rose-400 mt-0.5">
                3x Strike
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(isPreview ? `/admin/exams/${quizId}/edit` : "/student/exams")}
            className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all shadow-md"
          >
            <span>{isPreview ? "Kembali ke Editor Ujian Admin" : "Kembali ke Pusat Ujian CBT"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Normal Completed State View (Result & Gamification & Delayed Score)
  if (isCompleted) {
    const isScoreVisible =
      quiz?.isScoreVisible ??
      (resultData?.scoreReleased !== false && resultData?.score !== null && resultData?.score !== undefined);
    const isDiscussionVisible = Boolean(quiz?.isDiscussionVisible);
    const score = resultData?.score ?? 0;
    const totalScore =
      resultData?.totalScore ?? quiz.questions.reduce((acc: number, q: any) => acc + (q.points || 0), 0);
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const isPassed = percentage >= 70;
    const hasPendingEssays = resultData?.hasPendingEssays;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-lg bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 text-center space-y-6 animate-in fade-in zoom-in duration-200">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg ${
              !isScoreVisible
                ? "bg-blue-600 text-white shadow-blue-500/30"
                : isPassed
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-amber-500 text-white shadow-amber-500/30"
            }`}
          >
            {!isScoreVisible ? (
              <CheckCircle2 className="w-10 h-10" />
            ) : isPassed ? (
              <Trophy className="w-10 h-10" />
            ) : (
              <Sparkles className="w-10 h-10" />
            )}
          </div>

          <div>
            <span
              className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full ${
                !isScoreVisible
                  ? "bg-blue-950 text-blue-300 border border-blue-700"
                  : hasPendingEssays
                  ? "bg-blue-950 text-blue-300 border border-blue-700"
                  : isPassed
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                  : "bg-amber-950 text-amber-300 border border-amber-700"
              }`}
            >
              {!isScoreVisible
                ? "Ujian Telah Dikumpulkan"
                : hasPendingEssays
                ? "Terkumpul (Menunggu Review Essay)"
                : isPassed
                ? "Lulus dengan Baik"
                : "Hasil Ujian"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-2">{quiz.title}</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {!isScoreVisible
                ? "Seluruh jawaban Anda telah berhasil dikirim dan tersimpan di sistem."
                : hasPendingEssays
                ? "Soal pilihan ganda dinilai otomatis. Bagian uraian sedang ditinjau oleh Guru & AI."
                : "Ujian Anda telah selesai dan dinilai secara otomatis."}
            </p>
          </div>

          {/* If Score is Delayed / Hidden */}
          {!isScoreVisible ? (
            <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2 text-left">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Clock className="w-4 h-4" />
                <span>Pengumuman Nilai Ditunda oleh Guru</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nilai dan papan peringkat akan diumumkan oleh Guru setelah seluruh sesi ujian berakhir.
              </p>
              {quiz.scoreReleaseAt && (
                <div className="pt-2 border-t border-slate-700 text-[11px] text-amber-300 font-mono">
                  📅 Jadwal Rilis Nilai:{" "}
                  {new Date(quiz.scoreReleaseAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Score Box if Score is Released */
            <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-around">
              <div>
                <span className="text-xs text-slate-400 font-medium">Nilai Diperoleh</span>
                <div className="text-3xl font-black text-white mt-0.5">
                  {score} <span className="text-xs text-slate-400 font-normal">/ {totalScore}</span>
                </div>
              </div>
              <div className="w-px h-10 bg-slate-700"></div>
              <div>
                <span className="text-xs text-slate-400 font-medium">Persentase</span>
                <div className={`text-3xl font-black mt-0.5 ${isPassed ? "text-emerald-400" : "text-amber-400"}`}>
                  {percentage}%
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons: Discussion, Leaderboard & Return */}
          <div className="space-y-2.5 pt-2">
            {isDiscussionVisible && (
              <button
                onClick={() => setShowDiscussionModal(true)}
                className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/25 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>Lihat Pembahasan & Kunci Jawaban</span>
              </button>
            )}

            {isScoreVisible && (
              <button
                onClick={() => setShowLeaderboardModal(true)}
                className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/25 transition-all"
              >
                <Trophy className="w-4 h-4" />
                <span>Lihat Papan Peringkat / Leaderboard</span>
              </button>
            )}

            <button
              onClick={() => router.push(isPreview ? `/admin/exams/${quizId}/edit` : "/student/exams")}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all"
            >
              <span>{isPreview ? "Kembali ke Editor Ujian Admin" : "Kembali ke Pusat Ujian CBT"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modals for completed view */}
        <ExamDiscussionReviewModal
          isOpen={showDiscussionModal}
          onClose={() => setShowDiscussionModal(false)}
          quizTitle={quiz.title}
          score={score}
          totalScore={totalScore}
          questions={quiz.questions}
        />

        <ExamLeaderboardModal
          isOpen={showLeaderboardModal}
          onClose={() => setShowLeaderboardModal(false)}
          quizId={quizId}
          quizTitle={quiz.title}
        />
      </div>
    );
  }

  // Pre-Check Modal
  if (showPreCheck) {
    return (
      <>
        <ExamPreCheckModal
          quizTitle={quiz.title}
          durationMinutes={quiz.durationMinutes || 30}
          maxStrikes={quiz.maxStrikes || 3}
          enableCamera={Boolean(quiz.enableCameraProctor)}
          enableFullscreen={quiz.enableFullscreenLock ?? true}
          hasExamToken={quiz.hasExamToken}
          examTokenInput={examTokenInput}
          onTokenChange={setExamTokenInput}
          isPreview={isPreview}
          onStartExam={handleStartExam}
        />

        <ExamTutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
        />
      </>
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
    return (
      a.optionId ||
      (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.textResponse && a.textResponse.trim().length > 0)
    );
  }).length;

  const qType = currentQuestion?.type || "SINGLE_CHOICE";
  const currentAnswer = answers[currentQuestion?.id] || {};

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 selection:bg-blue-600 selection:text-white select-none">
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

      {/* FULLSCREEN ENFORCEMENT BANNER (DESKTOP/LAPTOP) */}
      {hasStarted && !isFullscreen && !isIOS && !isPreview && (quiz?.enableFullscreenLock ?? true) && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shadow-lg z-35 animate-pulse">
          <div className="flex items-center gap-2">
            <Maximize className="w-4 h-4 shrink-0" />
            <span>Mode Layar Penuh Wajib: Anda terdeteksi keluar dari layar penuh / membagi layar (Split Screen). Klik tombol untuk kembali ke Layar Penuh.</span>
          </div>
          <button
            onClick={() => enterFullscreen()}
            className="px-3.5 py-1.5 rounded-xl bg-white text-rose-700 font-extrabold text-xs shrink-0 cursor-pointer hover:bg-rose-50 shadow-md transition-all active:scale-95"
          >
            Aktifkan Layar Penuh
          </button>
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

          {/* Center/Right: Timer, Strikes, Tutorial Help, Palette */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

            {/* Tutorial Help Button */}
            <button
              onClick={() => setShowTutorialModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Panduan Ujian"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Panduan</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN EXAM WORKSPACE */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-32">
        <section className="flex flex-col space-y-6">
          {/* Question Card */}
          <div className="bg-slate-800/90 rounded-3xl p-5 sm:p-8 border border-slate-700/80 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              {/* Question Header Meta */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/60">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-mono font-black text-sm text-blue-400">
                    {currentIndex + 1}
                  </span>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Tipe: {qType.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-slate-500">Bobot: {currentQuestion.points} Poin</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFlag(currentIndex)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      flagged[currentIndex]
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-xs"
                        : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${flagged[currentIndex] ? "text-amber-400 fill-amber-400" : ""}`} />
                    <span>{flagged[currentIndex] ? "Ragu-Ragu" : "Tandai Ragu"}</span>
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed whitespace-pre-line">
                {currentQuestion.text}
              </div>

              {/* Question Image Attachment (if any) */}
              {currentQuestion.imageUrl && (
                <div className="my-4 max-w-xl rounded-2xl overflow-hidden border border-slate-700 bg-slate-950/60 p-2 shadow-inner group relative">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Gambar Soal #${currentIndex + 1}`}
                    onClick={() => setZoomImageUrl(currentQuestion.imageUrl)}
                    className="w-full max-h-80 object-contain rounded-xl mx-auto cursor-zoom-in hover:brightness-105 transition-all"
                  />
                  <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-slate-400">
                    <span>Klik / sentuh gambar untuk memperbesar</span>
                    <button
                      type="button"
                      onClick={() => setZoomImageUrl(currentQuestion.imageUrl)}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                    >
                      Perbesar
                    </button>
                  </div>
                </div>
              )}

              {/* DYNAMIC QUESTION INPUT BASED ON TYPE */}
              <div className="mt-6">
                {/* 1. SINGLE CHOICE */}
                {qType === "SINGLE_CHOICE" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt: any, optIdx: number) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isSelected = currentAnswer.optionId === opt.id;
                      const isCorrectAnswer = opt.isCorrect;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10"
                              : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${
                                isSelected ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-xs sm:text-sm font-medium leading-snug">{opt.text}</span>
                          </div>

                          {/* Supervisor Answer Key Peek (Admin Preview Only) */}
                          {isPreview && showAnswerKeys && isCorrectAnswer && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-600 text-emerald-400 text-[10px] font-bold shrink-0">
                              Kunci Benar ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. MULTIPLE CHOICE */}
                {qType === "MULTIPLE_CHOICE" && (
                  <div className="space-y-3">
                    <p className="text-xs text-blue-400 font-semibold mb-2">
                      * Pilih satu atau lebih jawaban yang menurut Anda benar.
                    </p>
                    {currentQuestion.options?.map((opt: any, optIdx: number) => {
                      const isSelected = (currentAnswer.selectedOptionIds || []).includes(opt.id);
                      const isCorrectAnswer = opt.isCorrect;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleToggleMultipleOption(currentQuestion.id, opt.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10"
                              : "bg-slate-900/60 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                                isSelected ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500 border border-slate-700"
                              }`}
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </div>
                            <span className="text-xs sm:text-sm font-medium leading-snug">{opt.text}</span>
                          </div>

                          {isPreview && showAnswerKeys && isCorrectAnswer && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-600 text-emerald-400 text-[10px] font-bold shrink-0">
                              Kunci Benar ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. TRUE / FALSE */}
                {qType === "TRUE_FALSE" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentQuestion.options?.map((opt: any) => {
                      const isSelected = currentAnswer.optionId === opt.id;
                      const isCorrectAnswer = opt.isCorrect;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                          className={`p-5 rounded-2xl border text-center transition-all cursor-pointer font-bold text-sm ${
                            isSelected
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                              : "bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-900 hover:border-slate-600"
                          }`}
                        >
                          {opt.text}
                          {isPreview && showAnswerKeys && isCorrectAnswer && (
                            <span className="block mt-1 text-[10px] text-emerald-400 font-normal">
                              (Kunci Benar ✓)
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
                    <label className="text-xs font-semibold text-slate-400 block">
                      Ketik jawaban singkat Anda di bawah ini:
                    </label>
                    <input
                      type="text"
                      value={currentAnswer.textResponse || ""}
                      onChange={(e) => handleTextResponseChange(currentQuestion.id, e.target.value)}
                      placeholder="Tuliskan jawaban singkat..."
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {isPreview && showAnswerKeys && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs space-y-1">
                        <span className="font-bold block">Kunci / Contoh Jawaban Ideal:</span>
                        <p>{currentQuestion.sampleAnswer || "Tidak ada contoh jawaban khusus."}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. ESSAY */}
                {qType === "ESSAY" && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-400 block">
                      Tuliskan penjelasan dan argumen lengkap Anda:
                    </label>
                    <textarea
                      rows={5}
                      value={currentAnswer.textResponse || ""}
                      onChange={(e) => handleTextResponseChange(currentQuestion.id, e.target.value)}
                      placeholder="Uraikan jawaban Anda di sini..."
                      className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed font-sans"
                    />

                    {isPreview && showAnswerKeys && (
                      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs space-y-2">
                        <span className="font-bold block">Rubrik / Kriteria Penilaian Guru:</span>
                        <p className="whitespace-pre-line text-slate-300">
                          {currentQuestion.gradingRubric || currentQuestion.sampleAnswer || "Belum ada rubrik terpasang."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 2. FLOATING DOCK NAVIGATION (MOBILE & DESKTOP) */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] sm:w-auto max-w-xl">
        <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2 sm:gap-3">
          {/* Previous Question Button */}
          <button
            onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
            disabled={currentIndex === 0}
            className="px-3 sm:px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          {/* Middle Pill: Number & Palette Trigger */}
          <button
            onClick={() => setShowQuestionPalette(true)}
            className="px-3 sm:px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer text-slate-200 transition-colors shadow-inner"
            title="Buka Kisi Palet Soal"
          >
            <Grid className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-xs sm:text-sm">
              No. <b className="text-white">{currentIndex + 1}</b> / {quiz.questions.length}
            </span>
          </button>

          {/* Flag / Ragu-ragu Button */}
          <button
            onClick={() => handleToggleFlag(currentIndex)}
            className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
              flagged[currentIndex]
                ? "bg-amber-500/25 border-amber-500 text-amber-300 shadow-xs"
                : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700"
            }`}
            title="Tandai Ragu-ragu"
          >
            <Flag className={`w-4 h-4 ${flagged[currentIndex] ? "text-amber-400 fill-amber-400" : ""}`} />
            <span className="hidden sm:inline">
              {flagged[currentIndex] ? "Ragu-Ragu" : "Tandai"}
            </span>
          </button>

          {/* Next Question / Submit Button */}
          {isLastQuestion ? (
            <button
              onClick={handleSubmitConfirmation}
              disabled={submitting}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? "Mengirim..." : "Kumpulkan"}</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((p) => Math.min(quiz.questions.length - 1, p + 1))}
              className="px-3 sm:px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2.5 FLOATING QUESTION PALETTE MODAL */}
      {showQuestionPalette && (
        <div
          onClick={() => setShowQuestionPalette(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Palet Kisi Soal
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  {answeredTotal} / {quiz.questions.length} Terjawab
                </span>
                <button
                  onClick={() => setShowQuestionPalette(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Color Legend */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1 shrink-0">
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
            <div className="grid grid-cols-5 gap-2.5 overflow-y-auto py-2 pr-1 flex-1">
              {quiz.questions.map((q: any, idx: number) => {
                const a = answers[q.id];
                const isAnswered =
                  a &&
                  (a.optionId ||
                    (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
                    (a.textResponse && a.textResponse.trim().length > 0));

                const isFlagged = !!flagged[idx];
                const isCurrent = currentIndex === idx;

                let btnClass = "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500";
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
                    className={`h-11 rounded-xl border text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Action inside palette */}
            <div className="pt-3 border-t border-slate-800 shrink-0">
              <button
                onClick={() => {
                  setShowQuestionPalette(false);
                  handleSubmitConfirmation();
                }}
                disabled={submitting}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/25 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kumpulkan Ujian Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI FACE PROCTORING WIDGET (PIP Thumbnail at Bottom Right - Only if enabled) */}
      <FaceProctorWidget
        enabled={Boolean(quiz.enableCameraProctor)}
        onViolation={handleViolation}
      />

      {/* 4. WARNING ALERT MODAL (STRIKE 1 & 2 RESET) */}
      {warningModalData?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/80 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto animate-bounce shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-black uppercase tracking-wider">
                <span>Pelanggaran {warningModalData.strikeCount} dari {warningModalData.maxStrikes}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Jawaban Dikosongkan & Diulang!
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {warningModalData.description}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs text-amber-200 text-left space-y-2 font-medium">
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Seluruh jawaban Anda sebelumnya telah <b>dihapus bersih</b>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Ujian Anda <b>diulang kembali dari soal nomor 1</b>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  Sisa kesempatan: <b>{Math.max(0, warningModalData.maxStrikes - warningModalData.strikeCount)}x lagi</b> sebelum akun Anda <b>DIDISKUALIFIKASI (Nilai 0)</b>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>Waktu timer ujian <b>tetap berjalan</b> sesuai durasi tersisa.</span>
              </div>
            </div>

            <button
              onClick={async () => {
                setWarningModalData(null);
                if (quiz?.enableFullscreenLock && !isPreview) {
                  await enterFullscreen();
                }
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-98"
            >
              Saya Paham & Mulai Ulang dari Soal No. 1
            </button>
          </div>
        </div>
      )}

      {/* 5. IMAGE ZOOM MODAL */}
      {zoomImageUrl && (
        <div
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-10 right-0 text-slate-300 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImageUrl}
              alt="Gambar Soal Diperbesar"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* 6. TUTORIAL MODAL */}
      <ExamTutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
      />

      {/* 7. FLOATING SUPERVISOR TOOLBAR (ADMIN PREVIEW ONLY) */}
      {isPreview && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4">
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
