"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Medal, User, Loader2 } from "lucide-react";

type LeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  level: number;
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
    <div className="w-full max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Leaderboard
        </h1>
        <p className="text-sm text-slate-400">
          Rankings are based on total XP earned from lessons and activities.
        </p>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-[#090d16]/95 backdrop-blur-md pt-2 pb-4 mb-6">
        <div className="flex bg-slate-800/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("global")}
            className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
              activeTab === "global"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
              activeTab === "monthly"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading leaderboard...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-3 items-end pt-8">
              {/* Silver - Rank 2 */}
              {top3[1] && (
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.3)]">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="absolute -bottom-3 -right-2 bg-slate-300 text-slate-800 text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-[#090d16]">
                      2
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white text-center line-clamp-1 w-full px-1">
                    {top3[1].name}
                  </p>
                  <p className="text-xs text-emerald-400 font-medium mt-1">
                    {top3[1].xp} XP
                  </p>
                  <div className="w-full h-24 sm:h-32 bg-gradient-to-t from-slate-300/20 to-slate-300/5 mt-3 rounded-t-xl border-t-2 border-slate-300/30" />
                </div>
              )}

              {/* Gold - Rank 1 */}
              {top3[0] && (
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <Medal className="w-8 h-8 text-yellow-400 mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                  <div className="relative mb-2">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                      <User className="w-10 h-10 text-slate-400" />
                    </div>
                    <div className="absolute -bottom-3 -right-2 bg-yellow-400 text-yellow-900 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-[#090d16]">
                      1
                    </div>
                  </div>
                  <p className="text-base font-bold text-white text-center line-clamp-1 w-full px-1">
                    {top3[0].name}
                  </p>
                  <p className="text-sm text-yellow-400 font-bold mt-1">
                    {top3[0].xp} XP
                  </p>
                  <div className="w-full h-32 sm:h-40 bg-gradient-to-t from-yellow-400/20 to-yellow-400/5 mt-3 rounded-t-xl border-t-2 border-yellow-400/30" />
                </div>
              )}

              {/* Bronze - Rank 3 */}
              {top3[2] && (
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center border-4 border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.3)]">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="absolute -bottom-3 -right-2 bg-amber-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-[#090d16]">
                      3
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white text-center line-clamp-1 w-full px-1">
                    {top3[2].name}
                  </p>
                  <p className="text-xs text-amber-500 font-medium mt-1">
                    {top3[2].xp} XP
                  </p>
                  <div className="w-full h-20 sm:h-28 bg-gradient-to-t from-amber-600/20 to-amber-600/5 mt-3 rounded-t-xl border-t-2 border-amber-600/30" />
                </div>
              )}
            </div>
          )}

          {/* Rest of the List */}
          {rest.length > 0 && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <ul className="divide-y divide-slate-800/50">
                {rest.map((student, index) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="w-8 text-center font-bold text-slate-500">
                      {index + 4}
                    </div>
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Level {student.level}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">
                        {student.xp}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        XP
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.length === 0 && !loading && (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No students on the leaderboard yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
