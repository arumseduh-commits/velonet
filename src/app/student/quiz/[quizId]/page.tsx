"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CheckCircle2, ArrowLeft, BrainCircuit } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function QuizTakingPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { confirm, toast } = useDialog();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<{ [qIndex: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const res = await fetch(`/api/quiz/${quizId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setQuiz(json.data);
      } else {
        toast.error("Kuis tidak ditemukan.");
      }
    } catch (err) {
      toast.error("Gagal memuat kuis.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qIndex: number, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: optionId }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < quiz.questions.length) {
      const ok = await confirm({
        title: "Peringatan",
        message: "Anda belum menjawab semua pertanyaan. Yakin ingin mengumpulkan?",
        variant: "warning",
        confirmText: "Kumpulkan",
      });
      if (ok) submitData();
    } else {
      const ok = await confirm({
        title: "Konfirmasi",
        message: "Yakin ingin mengumpulkan kuis ini?",
        variant: "info",
        confirmText: "Ya, Kumpulkan",
      });
      if (ok) submitData();
    }
  };

  const submitData = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = quiz.questions.map((q: any, idx: number) => ({
        questionId: q.id,
        optionId: answers[idx] || null,
      }));

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: formattedAnswers }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Kuis berhasil dikumpulkan!");
        router.push(`/student/learning`);
      } else {
        toast.error(json.error || "Gagal mengumpulkan kuis.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm font-medium">
        Memuat kuis...
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-sm">
        <p>Kuis tidak ditemukan atau tidak tersedia.</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 font-semibold hover:underline cursor-pointer">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-blue-600" />
              <span>{quiz.title}</span>
            </h1>
            {quiz.description && (
              <p className="text-xs text-slate-500 mt-1">{quiz.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="space-y-6">
        {quiz.questions.map((q: any, qIdx: number) => (
          <div key={q.id} className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-slate-900">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {qIdx + 1}. {q.text}
            </h3>
            <div className="space-y-2">
              {q.options.map((opt: any, optIdx: number) => {
                const isSelected = answers[qIdx] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(qIdx, opt.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between text-sm cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 border-blue-500 text-blue-800 font-semibold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50/50 hover:border-blue-300"
                    }`}
                  >
                    <span>{String.fromCharCode(65 + optIdx)}. {opt.text}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-4 pt-4 pb-4 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl px-4 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Mengumpulkan..." : "Kumpulkan Jawaban"}
        </button>
      </div>
    </div>
  );
}
