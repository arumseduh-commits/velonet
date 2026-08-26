"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  X,
  BookOpen,
  FolderKanban,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  Trash2,
  Globe,
  FileEdit,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  isPublished: boolean;
  createdAt: string;
}

export default function AdminCoursesPage() {
  const { toast, confirm } = useDialog();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const json = await res.json();
      if (Array.isArray(json)) {
        setCourses(json);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTitle("");
    setSlug("");
    setDescription("");
    setIsPublished(true);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Auto generate slug if user hasn't typed custom slug
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setSlug(generatedSlug);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error("Judul dan Slug kursus wajib diisi.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          isPublished,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Kursus baru berhasil dibuat!");
        fetchCourses();
        handleCloseModal();
      } else {
        toast.error(data.error || "Gagal membuat kursus.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan server.");
    } finally {
      setCreating(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  const publishedCount = courses.filter((c) => c.isPublished).length;
  const draftCount = courses.length - publishedCount;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100 pb-24">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <FolderKanban className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
                LMS Curriculum
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Manajemen Kursus & Modul
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola daftar kursus, kurikulum terstruktur, dan modul pembelajaran siswa
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Kursus Baru</span>
        </button>
      </div>

      {/* 2. Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold">Total Kursus</span>
          <p className="text-2xl sm:text-3xl font-black text-white">{courses.length}</p>
          <p className="text-[11px] text-slate-500">Semua kurikulum yang tersimpan</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold">Dipublikasikan</span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">{publishedCount}</p>
          <p className="text-[11px] text-slate-500">Aktif & dapat diakses siswa</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-semibold">Draft / Pending</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">{draftCount}</p>
          <p className="text-[11px] text-slate-500">Dalam tahap persiapan materi</p>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Cari kursus berdasarkan judul, slug, atau deskripsi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. Table Section */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-5 py-4">Judul Kursus & Info</th>
                <th className="px-5 py-4">Slug URL</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Tanggal Dibuat</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    <span>Memuat daftar kursus...</span>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 space-y-3">
                    <FolderKanban className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="font-semibold text-white">Belum Ada Kursus</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Belum ada kursus kurikulum yang dibuat. Klik tombol "Buat Kursus Baru" untuk mulai menyusun materi.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        <span>{course.title}</span>
                      </div>
                      <div className="text-slate-400 truncate max-w-sm text-xs mt-1">
                        {course.description || "Tidak ada deskripsi"}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      /course/{course.slug}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          course.isPublished
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {course.isPublished ? "PUBLISHED" : "DRAFT"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono">
                      {new Date(course.createdAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold text-xs transition-colors"
                      >
                        <span>Kelola Bab</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create Course Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Buat Kursus Baru</h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              <form id="create-course-form" onSubmit={handleCreateCourse} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="title" className="block font-bold text-slate-300">
                    Judul Kursus <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-600"
                    placeholder="Contoh: Mastering English Grammar & Speaking"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="slug" className="block font-bold text-slate-300">
                    Slug URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-600 font-mono"
                    placeholder="contoh: english-grammar-speaking"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="block font-bold text-slate-300">
                    Deskripsi Singkat
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-600 resize-none"
                    placeholder="Ringkasan kurikulum dan manfaat yang dipelajari siswa..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="isPublished" className="font-semibold text-slate-300 cursor-pointer">
                    Publikasikan langsung agar terlihat oleh siswa
                  </label>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-course-form"
                disabled={creating}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Kursus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
