"use client";

import React, { useEffect, useState } from "react";
import {
  Trophy,
  Medal,
  Award,
  Clock,
  User,
  X,
  Sparkles,
  RefreshCw,
  Crown,
  Flame,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  studentClass?: string | null;
  score: number;
  totalScore: number;
  percentage: number;
  durationMinutes?: number | null;
  submittedAt: string;
}

interface ExamLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  quizTitle: string;
}

export default function ExamLeaderboardModal({
  isOpen,
  onClose,
  quizId,
  quizTitle,
}: ExamLeaderboardModalProps) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoreReleased, setScoreReleased] = useState(true);
  const [scoreReleaseAt, setScoreReleaseAt] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && quizId) {
      fetchLeaderboard();
    }
  }, [isOpen, quizId]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quiz/${quizId}/leaderboard`);
      const json = await res.json();
      if (json.success && json.data) {
        setLeaderboard(json.data.leaderboard || []);
        setScoreReleased(json.data.scoreReleased !== false);
        setScoreReleaseAt(json.data.scoreReleaseAt || null);
      }
    } catch (e) {
      console.error("Failed to load exam leaderboard:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Papan Peringkat Ujian</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white truncate max-w-sm sm:max-w-md mt-0.5">
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <span>Memuat papan peringkat...</span>
            </div>
          ) : !scoreReleased ? (
            <div className="py-12 p-6 rounded-3xl bg-slate-800/80 border border-slate-700 text-center space-y-3">
              <Clock className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
              <h3 className="text-base font-bold text-white">Nilai Belum Dirilis oleh Guru</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Papan peringkat akan otomatis dibuka setelah seluruh siswa selesai mengerjakan dan nilai resmi diumumkan oleh Guru.
              </p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada peserta yang mengumpulkan ujian ini.
            </div>
          ) : (
            <>
              {/* TOP 3 PODIUM */}
              {leaderboard.length >= 1 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 pb-2 items-end">
                  {/* Rank 2 (Silver) */}
                  {top2 ? (
                    <div className="p-3 sm:p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-center flex flex-col items-center space-y-1 shadow-md">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 text-slate-200 border-2 border-slate-400 flex items-center justify-center font-black text-xs sm:text-sm">
                        2
                      </div>
                      <span className="text-xs font-black text-slate-200 truncate max-w-[90px] sm:max-w-[120px] block mt-1">
                        {top2.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{top2.studentClass || "Siswa"}</span>
                      <div className="text-xs font-black text-amber-400 font-mono">
                        {top2.score} pts
                      </div>
                    </div>
                  ) : (
                    <div></div>
                  )}

                  {/* Rank 1 (Gold - Tallest) */}
                  {top1 && (
                    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-2 border-amber-500/80 text-center flex flex-col items-center space-y-1.5 shadow-xl shadow-amber-500/10">
                      <Crown className="w-6 h-6 text-amber-400 animate-bounce" />
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500 text-slate-950 border-2 border-amber-300 flex items-center justify-center font-black text-sm sm:text-base shadow-lg">
                        1
                      </div>
                      <span className="text-xs sm:text-sm font-black text-white truncate max-w-[100px] sm:max-w-[140px] block mt-1">
                        {top1.name}
                      </span>
                      <span className="text-[10px] text-amber-300 font-semibold block">{top1.studentClass || "Siswa"}</span>
                      <div className="text-sm font-black text-amber-300 font-mono">
                        {top1.score} pts
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (Bronze) */}
                  {top3 ? (
                    <div className="p-3 sm:p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-center flex flex-col items-center space-y-1 shadow-md">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-950 text-amber-500 border-2 border-amber-700 flex items-center justify-center font-black text-xs sm:text-sm">
                        3
                      </div>
                      <span className="text-xs font-black text-slate-200 truncate max-w-[90px] sm:max-w-[120px] block mt-1">
                        {top3.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{top3.studentClass || "Siswa"}</span>
                      <div className="text-xs font-black text-amber-400 font-mono">
                        {top3.score} pts
                      </div>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>
              )}

              {/* COMPLETE RANKING LIST */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                  Seluruh Peringkat Peserta
                </span>

                <div className="space-y-1.5">
                  {leaderboard.map((item) => {
                    const isTop3 = item.rank <= 3;
                    return (
                      <div
                        key={item.userId}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          item.rank === 1
                            ? "bg-amber-950/40 border-amber-500/50 text-white font-bold"
                            : item.rank === 2
                            ? "bg-slate-800/90 border-slate-600 text-slate-200"
                            : item.rank === 3
                            ? "bg-amber-950/20 border-amber-800 text-slate-200"
                            : "bg-slate-900/60 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              item.rank === 1
                                ? "bg-amber-500 text-slate-950"
                                : item.rank === 2
                                ? "bg-slate-600 text-white"
                                : item.rank === 3
                                ? "bg-amber-800 text-white"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {item.rank}
                          </span>

                          <div className="min-w-0">
                            <span className="font-extrabold text-white block truncate max-w-[150px] sm:max-w-[220px]">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {item.studentClass || "Siswa"} • {item.percentage}%
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-amber-400 font-mono text-sm block">
                            {item.score} <span className="text-[10px] text-slate-400 font-normal">/ {item.totalScore}</span>
                          </span>
                          {item.durationMinutes && (
                            <span className="text-[10px] text-slate-400 block">
                              ⏱️ {item.durationMinutes} mnt
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
