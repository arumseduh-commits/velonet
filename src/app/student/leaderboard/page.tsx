"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Medal, User, Loader2, Sparkles, ArrowLeft, Flame, Award, CheckCircle2 } from "lucide-react";

type LeaderboardEntry = {
  id: string;
  name: string;
  studentClass?: string;
  xp: number;
  level: number;
  streak?: number;
  hadirCount?: number;
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"global" | "monthly">("global");
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`/api/leaderboard?type=${activeTab}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          setData(Array.isArray(json) ? json : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-6 text-slate-900">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-amber-50 via-orange-50/50 to-white border border-amber-200 shadow-sm text-slate-900">
        <div className="flex items-center gap-4">
          <Link
            href="/student"
            className="p-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200 shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold">
                Peringkat & Gamifikasi
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide mt-1 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              <span>Velocity Leaderboard</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Peringkat siswa paling rajin dan aktif berdasarkan perolehan XP kehadiran & materi
            </p>
          </div>
        </div>

        {/* Global vs Monthly Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("global")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "global"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua Waktu
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "monthly"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Bulan Ini
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm font-medium">Memuat papan peringkat...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3 text-slate-900 shadow-sm">
          <Trophy className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Belum Ada Peringkat</h3>
          <p className="text-xs text-slate-500">Lengkapi profil dan lakukan absensi kehadiran untuk masuk ke leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-6">
              {/* Rank 2 - Silver */}
              {top3[1] && (
                <div className="flex flex-col items-center p-4 rounded-3xl bg-gradient-to-t from-slate-50 via-slate-50/70 to-white border border-slate-200 shadow-sm relative text-center group hover:border-slate-300 transition-all text-slate-900">
                  <div className="relative mb-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-800 flex items-center justify-center font-black text-xl sm:text-2xl ring-2 ring-white shadow-xs">
                      {top3[1].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-black text-xs flex items-center justify-center border-2 border-white shadow-xs">
                      2
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate w-full px-1">
                    {top3[1].name}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">Kelas {top3[1].studentClass || "X"}</span>
                  <div className="mt-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black font-mono border border-slate-200">
                    {top3[1].xp} XP
                  </div>
                </div>
              )}

              {/* Rank 1 - Gold (Elevated in Center) */}
              {top3[0] && (
                <div className="flex flex-col items-center p-5 sm:p-6 rounded-3xl bg-gradient-to-t from-amber-50 via-yellow-50/50 to-white border-2 border-amber-300 shadow-md relative text-center group hover:border-amber-400 transition-all -translate-y-2 text-slate-900">
                  <div className="absolute -top-4 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs flex items-center gap-1">
                    <Medal className="w-3.5 h-3.5" />
                    <span>CHAMPION</span>
                  </div>
                  <div className="relative mb-3 mt-1">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md ring-4 ring-white">
                      {top3[0].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center border-2 border-white shadow-xs">
                      1
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate w-full px-1">
                    {top3[0].name}
                  </h3>
                  <span className="text-[11px] text-amber-800 font-semibold">Kelas {top3[0].studentClass || "X"}</span>
                  <div className="mt-2.5 px-4 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black font-mono border border-amber-300">
                    {top3[0].xp} XP
                  </div>
                </div>
              )}

              {/* Rank 3 - Bronze */}
              {top3[2] && (
                <div className="flex flex-col items-center p-4 rounded-3xl bg-gradient-to-t from-amber-50/40 via-orange-50/20 to-white border border-amber-200 shadow-sm relative text-center group hover:border-amber-300 transition-all text-slate-900">
                  <div className="relative mb-3">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-black text-xl sm:text-2xl ring-2 ring-white shadow-xs">
                      {top3[2].name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-xs">
                      3
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate w-full px-1">
                    {top3[2].name}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">Kelas {top3[2].studentClass || "X"}</span>
                  <div className="mt-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-black font-mono border border-amber-200">
                    {top3[2].xp} XP
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rest of the List Table */}
          {rest.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm text-slate-900">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Daftar Peringkat Siswa</span>
                <span>Total: {data.length} Peserta</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {rest.map((student, index) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 text-center font-black text-slate-500 text-sm">
                      #{index + 4}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Kelas {student.studentClass || "X"} • Level {student.level}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black font-mono text-amber-600">
                        {student.xp}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        XP Points
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
