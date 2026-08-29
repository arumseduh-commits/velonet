"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  X,
  Sparkles,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface OptionReview {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface QuestionReview {
  id: string;
  type: string;
  text: string;
  imageUrl?: string | null;
  points: number;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  explanation?: string | null;
  options?: OptionReview[];
  studentAnswer?: {
    optionId?: string | null;
    selectedOptionIds?: string[] | null;
    textResponse?: string | null;
    isCorrect?: boolean;
    earnedPoints?: number;
    feedback?: string | null;
  };
}

interface ExamDiscussionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizTitle: string;
  score: number;
  totalScore: number;
  questions: QuestionReview[];
}

export default function ExamDiscussionReviewModal({
  isOpen,
  onClose,
  quizTitle,
  score,
  totalScore,
  questions,
}: ExamDiscussionReviewModalProps) {
  const [filter, setFilter] = useState<"ALL" | "CORRECT" | "INCORRECT">("ALL");

  if (!isOpen) return null;

  const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;

  const filteredQuestions = questions.filter((q) => {
    const isCorrect = q.studentAnswer?.isCorrect;
    if (filter === "CORRECT") return isCorrect === true;
    if (filter === "INCORRECT") return isCorrect === false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Review & Pembahasan
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Nilai: <b className="text-white">{score}/{totalScore} ({percentage}%)</b>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white truncate max-w-md mt-0.5">
                {quizTitle}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900/80 border-b border-slate-800/80 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            Semua Soal ({questions.length})
          </button>
          <button
            onClick={() => setFilter("CORRECT")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === "CORRECT"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-800 text-emerald-400 hover:bg-slate-700"
            }`}
          >
            Benar ({questions.filter((q) => q.studentAnswer?.isCorrect === true).length})
          </button>
          <button
            onClick={() => setFilter("INCORRECT")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === "INCORRECT"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-800 text-rose-400 hover:bg-slate-700"
            }`}
          >
            Salah ({questions.filter((q) => q.studentAnswer?.isCorrect === false).length})
          </button>
        </div>

        {/* Question List Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Tidak ada butir soal dalam filter ini.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const ans = q.studentAnswer;
              const isCorrect = ans?.isCorrect;
              const earnedPts = ans?.earnedPoints ?? (isCorrect ? q.points : 0);

              return (
                <div
                  key={q.id}
                  className={`p-5 sm:p-6 rounded-3xl border transition-all ${
                    isCorrect === true
                      ? "bg-slate-900/90 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                      : isCorrect === false
                      ? "bg-slate-900/90 border-rose-500/40 shadow-sm shadow-rose-500/10"
                      : "bg-slate-900/90 border-slate-700 shadow-sm"
                  }`}
                >
                  {/* Header Question Item */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-black">
                        #{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        {q.type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCorrect === true ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Benar (+{earnedPts} Poin)</span>
                        </span>
                      ) : isCorrect === false ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-700 text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Salah ({earnedPts}/{q.points} Poin)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-700 text-xs font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                          <span>Review Guru ({earnedPts}/{q.points} Poin)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-semibold text-slate-100 whitespace-pre-line leading-relaxed">
                    {q.text}
                  </p>

                  {/* Image Attachment (if any) */}
                  {q.imageUrl && (
                    <div className="my-3 max-w-md rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                      <img
                        src={q.imageUrl}
                        alt="Gambar Soal"
                        className="w-full max-h-56 object-contain rounded-xl"
                      />
                    </div>
                  )}

                  {/* Multiple Choice Options Breakdown */}
                  {q.options && q.options.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isStudentChoice =
                          ans?.optionId === opt.id ||
                          (ans?.selectedOptionIds && ans.selectedOptionIds.includes(opt.id));
                        const isOfficialKey = opt.isCorrect;

                        let optStyle = "bg-slate-800/60 border-slate-700 text-slate-300";
                        if (isOfficialKey && isStudentChoice) {
                          optStyle = "bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold";
                        } else if (isOfficialKey && !isStudentChoice) {
                          optStyle = "bg-emerald-950/40 border-emerald-600/80 text-emerald-300 font-semibold";
                        } else if (!isOfficialKey && isStudentChoice) {
                          optStyle = "bg-rose-950/80 border-rose-500 text-rose-200 font-bold";
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${optStyle}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-slate-900/80 border border-slate-700 flex items-center justify-center font-bold text-[11px]">
                                {letter}
                              </span>
                              <span>{opt.text}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isStudentChoice && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-900/80 text-blue-200 text-[10px] font-bold">
                                  Jawaban Anda
                                </span>
                              )}
                              {isOfficialKey && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-900/80 text-emerald-200 text-[10px] font-extrabold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Kunci Benar</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text / Essay Response Breakdown */}
                  {ans?.textResponse && (
                    <div className="mt-4 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Jawaban Teks Anda:
                      </span>
                      <p className="text-slate-200 font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 whitespace-pre-line">
                        {ans.textResponse}
                      </p>
                    </div>
                  )}

                  {/* Sample Answer / Grading Rubric / Explanation */}
                  {(q.explanation || q.sampleAnswer || q.gradingRubric) && (
                    <div className="mt-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-700/60 space-y-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-extrabold">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Pembahasan & Penjelasan Soal:</span>
                      </div>

                      {q.explanation && (
                        <div>
                          <p className="text-slate-200 mt-0.5 leading-relaxed font-medium whitespace-pre-line bg-indigo-950/60 p-3 rounded-xl border border-indigo-800/60">
                            {q.explanation}
                          </p>
                        </div>
                      )}

                      {q.sampleAnswer && (
                        <div>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">
                            Contoh Jawaban Ideal / Kunci:
                          </span>
                          <p className="text-slate-200 mt-0.5 leading-relaxed font-medium">
                            {q.sampleAnswer}
                          </p>
                        </div>
                      )}

                      {q.gradingRubric && (
                        <div className="pt-1.5 border-t border-indigo-800/50">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">
                            Rubrik Penjelasan & Kata Kunci:
                          </span>
                          <p className="text-slate-300 mt-0.5 leading-relaxed">
                            {q.gradingRubric}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            Tutup Pembahasan
          </button>
        </div>
      </div>
    </div>
  );
}
