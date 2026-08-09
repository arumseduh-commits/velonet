"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileSpreadsheet,
  Users,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Loader2,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface CumulativeItem {
  participantId: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  registrationStatus: string;
  totalSessions: number;
  hadirCount: number;
  izinCount: number;
  alpaCount: number;
  percentage: number;
}

export default function CumulativeReportsPage() {
  const { toast } = useDialog();
  const [reportList, setReportList] = useState<CumulativeItem[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReport = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const url = new URL("/api/reports/cumulative", window.location.origin);
      if (selectedMonth !== "ALL") url.searchParams.set("month", selectedMonth);
      if (selectedYear !== "ALL") url.searchParams.set("year", selectedYear);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setReportList(json.report);
        setTotalSessions(json.totalSessions);
        setTotalParticipants(json.totalParticipants);
      }
    } catch (err) {
      console.error("Failed to fetch cumulative report:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // Real-time Auto-Sync Poller (Every 4s)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchReport(true);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedMonth, selectedYear]);

  const handleExportCSV = () => {
    const url = `/api/reports/cumulative/export?month=${selectedMonth}&year=${selectedYear}`;
    window.open(url, "_blank");
    toast.success("Mengekspor Laporan Kumulatif Kehadiran...");
  };

  // Filtered List
  const filteredList = reportList.filter((item) => {
    return (
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phoneNumber.includes(searchQuery) ||
      item.studentClass.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate Community Average %
  const communityAveragePct =
    reportList.length > 0
      ? Math.round(
          reportList.reduce((acc, curr) => acc + curr.percentage, 0) /
            reportList.length
        )
      : 0;

  // Find Top Attender
  const topAttender =
    reportList.length > 0
      ? [...reportList].sort((a, b) => b.percentage - a.percentage)[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Rekapitulasi Kehadiran Progresif</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Laporan Kumulatif Bulanan & Semester
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Rekap total keaktifan anggota komunitas Velocity secara kumulatif dari seluruh sesi pertemuan.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel Kumulatif (.csv)</span>
        </button>
      </div>

      {/* Overview Stat Cards (4 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Total Sesi Periode Ini
          </span>
          <div className="text-2xl font-extrabold text-white">{totalSessions} <span className="text-xs font-normal text-slate-400">Sesi</span></div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            Total Anggota Terdaftar
          </span>
          <div className="text-2xl font-extrabold text-white">{totalParticipants} <span className="text-xs font-normal text-slate-400">Orang</span></div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Rata-rata Kehadiran
          </span>
          <div className="text-2xl font-extrabold text-amber-400">{communityAveragePct}%</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-purple-400" />
            Anggota Paling Rajin
          </span>
          <div className="text-sm font-bold text-purple-300 truncate">
            {topAttender ? topAttender.name : "-"}
          </div>
          <span className="text-[10px] text-purple-400 font-semibold">
            {topAttender ? `Kehadiran: ${topAttender.percentage}%` : ""}
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, kelas, atau No. WA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filter Periode:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Bulan</option>
            <option value="1">Januari</option>
            <option value="2">Februari</option>
            <option value="3">Maret</option>
            <option value="4">April</option>
            <option value="5">Mei</option>
            <option value="6">Juni</option>
            <option value="7">Juli</option>
            <option value="8">Agustus</option>
            <option value="9">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Tahun</option>
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
          </select>
        </div>
      </div>

      {/* Datatable */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">No</th>
                <th className="p-4">Nama Peserta</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">No. WhatsApp</th>
                <th className="p-4 text-center">Total Sesi</th>
                <th className="p-4 text-center text-emerald-400">Hadir (GPS)</th>
                <th className="p-4 text-center text-amber-400">Izin / Sakit</th>
                <th className="p-4 text-center text-rose-400">Alpa</th>
                <th className="p-4">Progres Kehadiran (%)</th>
                <th className="p-4 text-right">Detail</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    Memuat data rekap kumulatif...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    Tidak ada data anggota yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const pctColor =
                    item.percentage >= 75
                      ? "text-emerald-400 bg-emerald-400"
                      : item.percentage >= 50
                      ? "text-amber-400 bg-amber-400"
                      : "text-rose-400 bg-rose-400";

                  return (
                    <tr key={item.participantId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-4 font-bold text-white">{item.name}</td>
                      <td className="p-4 font-medium text-slate-300">{item.studentClass}</td>
                      <td className="p-4 font-mono text-slate-400">+{item.phoneNumber}</td>
                      <td className="p-4 text-center font-bold text-slate-300">{item.totalSessions}</td>
                      <td className="p-4 text-center font-bold text-emerald-400">{item.hadirCount}</td>
                      <td className="p-4 text-center font-bold text-amber-400">{item.izinCount}</td>
                      <td className="p-4 text-center font-bold text-rose-400">{item.alpaCount}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-bold w-10 text-right ${pctColor.split(" ")[0]}`}>
                            {item.percentage}%
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pctColor.split(" ")[1]}`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/admin/participants/${item.participantId}`}
                          className="p-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                        >
                          <span>Profil</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
