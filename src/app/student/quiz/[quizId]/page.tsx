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
      <div className="p-8 text-center text-slate-400 text-sm">Memuat kuis...</div>
    );
  }

  if (!quiz) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <p>Kuis tidak ditemukan atau tidak tersedia.</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:underline">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-blue-400" />
              <span>{quiz.title}</span>
            </h1>
            {quiz.description && (
              <p className="text-xs text-slate-400 mt-1">{quiz.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="space-y-6">
        {quiz.questions.map((q: any, qIdx: number) => (
          <div key={q.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-semibold text-white text-sm sm:text-base">
              {qIdx + 1}. {q.text}
            </h3>
            <div className="space-y-2">
              {q.options.map((opt: any, optIdx: number) => {
                const isSelected = answers[qIdx] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(qIdx, opt.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between text-sm sm:text-base ${
                      isSelected
                        ? "bg-blue-500/20 border-blue-500 text-blue-300 font-semibold"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{String.fromCharCode(65 + optIdx)}. {opt.text}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-4 pt-4 pb-4 bg-slate-950/80 backdrop-blur-md">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? "Mengumpulkan..." : "Kumpulkan Jawaban"}
        </button>
      </div>
    </div>
  );
}
