"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  RefreshCw,
  Sparkles,
  ExternalLink,
  BrainCircuit,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  level: string;
  summary: string;
  sourceUrl: string;
  quiz: any[];
  scrapedAt: string;
}

export default function AdminLearningPage() {
  const { toast, confirm } = useDialog();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState(20);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/articles");
      const json = await res.json();
      if (json.success && json.data) {
        setArticles(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch articles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleTriggerScraper = async () => {
    const confirmed = await confirm({
      title: "Jalankan Dynamic Web Scraper MisterGuru",
      message: `Apakah Anda yakin ingin meng-scrape ${scrapeLimit} materi & latihan soal terbaru langsung dari MisterGuru.web.id?`,
      confirmText: "Ya, Mulai Scraping Live",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!confirmed) return;

    setScraping(true);
    toast.info("Memulai dynamic Web Scraper ke MisterGuru.web.id...");

    try {
      const res = await fetch("/api/learning/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: scrapeLimit }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Berhasil meng-scrape ${json.totalScraped} artikel! 🎉`);
        fetchArticles();
      } else {
        toast.error(json.error || "Gagal meng-scrape materi.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setScraping(false);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      a.title.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.summary && a.summary.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold">
              MisterGuru Web Scraper Engine
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide mt-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span>Kelola Materi & Dynamic Scraper MisterGuru</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ambil materi, bacaan, & kuis interaktif secara otomatis langsung dari sumber resmi <b>MisterGuru.web.id</b>.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 pl-2">Jumlah:</span>
            <select
              value={scrapeLimit}
              onChange={(e) => setScrapeLimit(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value={10}>10 Artikel</option>
              <option value={20}>20 Artikel</option>
              <option value={30}>30 Artikel</option>
              <option value={50}>50 Artikel</option>
            </select>
          </div>

          <button
            onClick={handleTriggerScraper}
            disabled={scraping}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {scraping ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sedang Meng-scrape Live...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Sync / Scrape Live Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Datatable Card */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-extrabold text-white text-base">
              Daftar Artikel Scraped ({articles.length} Materi)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Materi yang tersimpan di database VeloNet dan aktif di Portal Siswa
            </p>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Cari materi scraped..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Judul Materi Scraped</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Level</th>
                <th className="py-3.5 px-4">Soal Kuis</th>
                <th className="py-3.5 px-4">Sumber Asli</th>
                <th className="py-3.5 px-4 text-right">Waktu Scraped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Memuat materi scraped...
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada materi scraped. Klik "Sync / Scrape Live Sekarang" di atas untuk mengambil materi dari MisterGuru.web.id!
                  </td>
                </tr>
              ) : (
                filteredArticles.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white max-w-xs truncate">
                      {a.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                        {a.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-emerald-400">
                      {a.level}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold flex items-center gap-1 w-max">
                        <BrainCircuit className="w-3 h-3" />
                        {a.quiz ? a.quiz.length : 0} Soal
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        <span>MisterGuru Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-mono">
                      {a.scrapedAt ? new Date(a.scrapedAt).toLocaleString("id-ID") : "Seed"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
