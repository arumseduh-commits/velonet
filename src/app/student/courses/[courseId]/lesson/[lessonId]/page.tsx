"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/DialogProvider";
import { Menu, X, PlayCircle, FileText, CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

// Mock Data
const MOCK_COURSE = {
  id: "course-1",
  title: "Mastering React 18 & Next.js 14",
  chapters: [
    {
      id: "chapter-1",
      title: "Getting Started",
      lessons: [
        { id: "lesson-1", title: "Introduction to Next.js", type: "video", duration: "10:30", completed: true },
        { id: "lesson-2", title: "Setting up the Environment", type: "text", duration: "5 min read", completed: true },
      ]
    },
    {
      id: "chapter-2",
      title: "App Router Deep Dive",
      lessons: [
        { id: "lesson-3", title: "Routing and Layouts", type: "video", duration: "15:45", completed: false },
        { id: "lesson-4", title: "Server Components vs Client Components", type: "text", duration: "10 min read", completed: false },
        { id: "lesson-5", title: "Data Fetching", type: "video", duration: "20:00", completed: false },
      ]
    }
  ]
};

export default function LessonViewer() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;
  
  const { toast, confirm } = useDialog();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Find current lesson
  let currentLesson: any = null;
  let currentChapter: any = null;
  
  MOCK_COURSE.chapters.forEach(ch => {
    const l = ch.lessons.find(ls => ls.id === lessonId);
    if (l) {
      currentLesson = l;
      currentChapter = ch;
    }
  });

  // If not found, use first as default for mock
  if (!currentLesson) {
    currentLesson = MOCK_COURSE.chapters[0].lessons[0];
    currentChapter = MOCK_COURSE.chapters[0];
  }

  const handleMarkComplete = async () => {
    const confirmed = await confirm({
      title: "Selesaikan Pelajaran?",
      message: "Apakah Anda yakin ingin menandai pelajaran ini sebagai selesai?",
      confirmText: "Ya, Selesaikan",
      variant: "success",
      icon: "success"
    });
    
    if (confirmed) {
      toast.success("Pelajaran berhasil diselesaikan!");
    }
  };

  if (!isClient) return null;

  return (
    <div className="flex h-[100dvh] bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-out lg:relative lg:translate-x-0 flex flex-col ${
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <Link href={`/student/learning`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Kembali ke Dashboard
            </Link>
            <h2 className="font-bold text-white text-sm md:text-base line-clamp-2 leading-tight">
              {MOCK_COURSE.title}
            </h2>
          </div>
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Tutup navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6 md:space-y-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {MOCK_COURSE.chapters.map((chapter, idx) => (
            <div key={chapter.id} className="space-y-3">
              <h3 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Bagian {idx + 1}: {chapter.title}
              </h3>
              <div className="space-y-1.5">
                {chapter.lessons.map(lesson => {
                  const isActive = lesson.id === lessonId || lesson.id === currentLesson.id;
                  return (
                    <Link
                      key={lesson.id}
                      href={`/student/courses/${courseId}/lesson/${lesson.id}`}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
                        isActive 
                          ? "bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-sm" 
                          : "hover:bg-slate-800/80 text-slate-300 border border-transparent"
                      }`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <div className="mt-0.5">
                        {lesson.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-600"}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold leading-snug ${isActive ? "text-blue-100" : "text-slate-200"}`}>
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-slate-500">
                          {lesson.type === "video" ? (
                            <PlayCircle className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>{lesson.duration}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
        {/* Header (Visible on Mobile) */}
        <header className="lg:hidden flex items-center gap-3 p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{currentChapter.title}</p>
            <h1 className="text-sm md:text-base font-bold text-white truncate">{currentLesson.title}</h1>
          </div>
        </header>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="max-w-5xl mx-auto w-full p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
            
            {/* Desktop Header Title */}
            <div className="hidden lg:block space-y-2.5 mb-8">
               <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                  <span className="uppercase tracking-wider text-xs">{currentChapter.title}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-300">{currentLesson.title}</span>
               </div>
               <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  {currentLesson.title}
               </h1>
            </div>

            {/* Video or Rich Text Content */}
            {currentLesson.type === "video" ? (
              <div className="aspect-video w-full bg-slate-900 rounded-2xl md:rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative group flex items-center justify-center">
                {/* Mock Video Embed */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-slate-900/80"></div>
                <PlayCircle className="w-16 h-16 md:w-24 md:h-24 text-white/50 group-hover:text-white group-hover:scale-110 transition-all cursor-pointer z-10" />
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 z-10">
                  <p className="text-xs font-mono font-medium text-white">
                    {currentLesson.duration}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl border border-slate-800/50 shadow-lg prose prose-invert prose-slate max-w-none prose-headings:font-bold prose-a:text-blue-400">
                <h2>Ringkasan Materi</h2>
                <p>
                  Ini adalah simulasi teks pelajaran. Pada aplikasi aslinya, area ini akan me-render HTML atau Markdown 
                  yang diambil dari server / database.
                </p>
                <p>
                  Pastikan materi mudah dibaca di perangkat seluler dengan ukuran font yang nyaman, line-height yang cukup, 
                  dan kontras warna yang baik.
                </p>
                <ul>
                  <li>Poin kunci pertama untuk dipelajari</li>
                  <li>Pemahaman tentang konsep dasar framework modern</li>
                  <li>Cara mengelola state dan data fetching</li>
                </ul>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-8 md:pt-12 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
              <button 
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> 
                <span className="hidden sm:inline">Pelajaran Sebelumnya</span>
                <span className="sm:hidden">Sebelumnya</span>
              </button>
              
              <button
                onClick={handleMarkComplete}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
              >
                <CheckCircle2 className="w-5 h-5" />
                Tandai Selesai
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
