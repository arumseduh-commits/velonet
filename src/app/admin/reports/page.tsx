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
    <div className="space-y-6 text-slate-900 pb-20">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Rekapitulasi Kehadiran Progresif</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Laporan Kumulatif Bulanan & Semester
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Rekap total keaktifan anggota komunitas Velocity secara kumulatif dari seluruh sesi pertemuan.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel Kumulatif (.csv)</span>
        </button>
      </div>

      {/* Overview Stat Cards (4 Columns) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Total Sesi Periode Ini
          </span>
          <div className="text-2xl font-black text-slate-900">{totalSessions} <span className="text-xs font-normal text-slate-500">Sesi</span></div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            Total Anggota Terdaftar
          </span>
          <div className="text-2xl font-black text-slate-900">{totalParticipants} <span className="text-xs font-normal text-slate-500">Orang</span></div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            Rata-rata Kehadiran
          </span>
          <div className="text-2xl font-black text-amber-600">{communityAveragePct}%</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-purple-600" />
            Anggota Paling Rajin
          </span>
          <div className="text-sm font-bold text-purple-700 truncate">
            {topAttender ? topAttender.name : "-"}
          </div>
          <span className="text-[10px] text-purple-600 font-semibold">
            {topAttender ? `Kehadiran: ${topAttender.percentage}%` : ""}
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, kelas, atau No. WA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filter Periode:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
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
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
          >
            <option value="ALL">Semua Tahun</option>
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
          </select>
        </div>
      </div>

      {/* Datatable */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">No</th>
                <th className="p-4">Nama Peserta</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">No. WhatsApp</th>
                <th className="p-4 text-center">Total Sesi</th>
                <th className="p-4 text-center text-emerald-700">Hadir (GPS)</th>
                <th className="p-4 text-center text-amber-700">Izin / Sakit</th>
                <th className="p-4 text-center text-rose-700">Alpa</th>
                <th className="p-4">Progres Kehadiran (%)</th>
                <th className="p-4 text-right">Detail</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
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
                      ? "text-emerald-600 bg-emerald-500"
                      : item.percentage >= 50
                      ? "text-amber-600 bg-amber-500"
                      : "text-rose-600 bg-rose-500";

                  return (
                    <tr key={item.participantId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-4 font-bold text-slate-900">{item.name}</td>
                      <td className="p-4 font-medium text-slate-700">{item.studentClass}</td>
                      <td className="p-4 font-mono text-slate-500">+{item.phoneNumber}</td>
                      <td className="p-4 text-center font-bold text-slate-800">{item.totalSessions}</td>
                      <td className="p-4 text-center font-bold text-emerald-600">{item.hadirCount}</td>
                      <td className="p-4 text-center font-bold text-amber-600">{item.izinCount}</td>
                      <td className="p-4 text-center font-bold text-rose-600">{item.alpaCount}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-bold w-10 text-right ${pctColor.split(" ")[0]}`}>
                            {item.percentage}%
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pctColor.split(" ")[1]}`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/admin/participants/${item.phoneNumber}`}
                          className="p-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
                        >
                          <span>Profil</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
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
