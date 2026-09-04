"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles,
  Bot,
  User,
  Send,
  Paperclip,
  X,
  Minus,
  Maximize2,
  Settings,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  FileText,
  CheckCircle2,
  ArrowRight,
  Key,
  ShieldAlert,
  Layers,
  Image as ImageIcon,
  ChevronDown,
  Brain,
  Upload,
  History,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { parseQuestionContent } from "@/lib/question-utils";

export function AdminFloatingChat() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, confirm } = useDialog();

  // Floating Window State
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");

  // Chat Sessions & Messages
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Publishing / Adding questions state
  const [publishing, setPublishing] = useState(false);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [selectedExistingQuizId, setSelectedExistingQuizId] = useState<string>("");
  const [isAppendModalOpen, setIsAppendModalOpen] = useState(false);
  const [draftToAppend, setDraftToAppend] = useState<any>(null);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate thumbnail preview when attachedFile is an image
  useEffect(() => {
    if (attachedFile && (attachedFile.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(attachedFile.name))) {
      const url = URL.createObjectURL(attachedFile);
      setPreviewImageSrc(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewImageSrc(null);
    }
  }, [attachedFile]);

  // Load API Key from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("velonet_gemini_api_key") || "";
      setGeminiApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

  // Track elapsed seconds during send/analysis
  useEffect(() => {
    let timer: any = null;
    if (sending) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sending]);

  // Fetch or initialize session when chat opens
  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      loadSessions();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sending, isOpen]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/admin/ai/chat/session");
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setSessions(json.data);
        setActiveSessionId(json.data[0].id);
        setMessages(json.data[0].messages || []);
      } else {
        await createNewSession("Diskusi Admin Baru");
      }
    } catch (err) {
      console.warn("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const createNewSession = async (title = "Sesi Baru") => {
    try {
      const res = await fetch("/api/admin/ai/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSessions((prev) => [json.data, ...prev]);
        setActiveSessionId(json.data.id);
        setMessages(json.data.messages || []);
      }
    } catch (e) {
      toast.error("Gagal membuat sesi baru.");
    }
  };

  const switchSession = (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId);
    if (s) {
      setActiveSessionId(s.id);
      setMessages(s.messages || []);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string, sessionTitle: string) => {
    e.stopPropagation();

    const ok = await confirm({
      title: "Hapus Sesi Percakapan?",
      message: `Hapus riwayat "${sessionTitle}" beserta semua pesannya? Tindakan ini tidak dapat dibatalkan.`,
      variant: "danger",
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/ai/chat/session?id=${sessionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Sesi berhasil dihapus");
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);

        if (activeSessionId === sessionId) {
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
            setMessages(remaining[0].messages || []);
          } else {
            createNewSession("Sesi #1");
          }
        }
      } else {
        toast.error(json.error || "Gagal menghapus sesi.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan jaringan.");
    }
  };

  const handleClearAllSessions = async () => {
    const ok = await confirm({
      title: "Hapus Seluruh Riwayat?",
      message: "Seluruh riwayat sesi AI Copilot akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      variant: "danger",
      confirmText: "Hapus Semua",
      cancelText: "Batal",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/ai/chat/session?all=true", {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Semua sesi percakapan berhasil dibersihkan!");
        setSessions([]);
        await createNewSession("Sesi #1");
        setIsHistoryOpen(false);
      } else {
        toast.error(json.error || "Gagal membersihkan riwayat.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan jaringan.");
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setGeminiApiKey(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("velonet_gemini_api_key", trimmed);
        toast.success("Gemini API Key tersimpan di browser Anda!");
      } else {
        localStorage.removeItem("velonet_gemini_api_key");
        toast.info("Gemini API Key dihapus. Bot akan memakai sistem fallback.");
      }
    }
    setIsSettingsOpen(false);
  };

  // Send message or upload document
  const handleSendMessage = async (presetPrompt?: string) => {
    const textToSend = presetPrompt || inputText.trim();
    if ((!textToSend && !attachedFile) || !activeSessionId || sending) return;

    setInputText("");
    const currentFile = attachedFile;
    setAttachedFile(null);
    setSending(true);

    // Optimistically show user message
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: currentFile
        ? `📎 [Lampiran: ${currentFile.name}]\n${textToSend || "Tolong analisa dokumen ini dan jadikan soal CBT."}`
        : textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let json: any;

      if (currentFile) {
        setUploadFileName(currentFile.name);
        setUploadFileSizeMB((currentFile.size / (1024 * 1024)).toFixed(1));
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("sessionId", activeSessionId);
        formData.append("content", textToSend);
        formData.append("file", currentFile);
        if (geminiApiKey) formData.append("apiKey", geminiApiKey);

        json = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/admin/ai/chat/message");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve(parsed);
            } catch (e) {
              reject(new Error("Gagal mengurai respon server."));
            }
          };

          xhr.onerror = () => reject(new Error("Koneksi gagal saat mengunggah berkas."));
          xhr.send(formData);
        });

        setUploadProgress(null);
      } else {
        // Send JSON
        const res = await fetch("/api/admin/ai/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            content: textToSend,
            apiKey: geminiApiKey || undefined,
          }),
        });
        json = await res.json();
      }

      if (json.success && json.data) {
        const aiMsg = {
          id: json.data.messageId || "ai-" + Date.now(),
          role: "assistant",
          content: json.data.reply,
          generatedQuizDraft: json.data.quizDraft ? JSON.stringify(json.data.quizDraft) : null,
          adminAction: json.data.adminAction || null,
          source: json.data.source || "gemini",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        toast.error(json.error || "Gagal mendapatkan balasan dari bot.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kendala koneksi ke server Copilot.");
    } finally {
      setUploadProgress(null);
      setSending(false);
    }
  };

  // Publish Draft Quiz to VeloExambro
  const handlePublishQuiz = async (draft: any) => {
    const ok = await confirm({
      title: "Terbitkan ke VeloExambro CBT",
      message: `Terbitkan kuis "${draft.title}" (${draft.questions?.length} soal multi-format) langsung ke ujian CBT VeloExambro?`,
      variant: "success",
      confirmText: "Ya, Terbitkan Sekarang",
      cancelText: "Batal",
    });

    if (!ok) return;

    setPublishing(true);
    try {
      const res = await fetch("/api/admin/quiz/create-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (json.success && json.data) {
        toast.success("Kuis CBT berhasil diterbitkan!");
        setIsOpen(false);
        router.push(`/admin/exams/${json.data.quizId}/proctor`);
      } else {
        toast.error(json.error || "Gagal menerbitkan kuis.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan saat menerbitkan kuis.");
    } finally {
      setPublishing(false);
    }
  };

  // Open modal to append questions to an existing quiz
  const handleOpenAppendModal = async (draft: any) => {
    setDraftToAppend(draft);
    try {
      const res = await fetch("/api/admin/exams?page=1&limit=50");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setExistingQuizzes(json.data);
        if (json.data.length > 0) {
          setSelectedExistingQuizId(json.data[0].id);
        }
      }
    } catch (e) {}
    setIsAppendModalOpen(true);
  };

  const handleConfirmAppendQuestions = async () => {
    if (!selectedExistingQuizId || !draftToAppend) return;

    const ok = await confirm({
      title: "Tambahkan Soal ke Kuis",
      message: `Tambahkan ${draftToAppend.questions.length} soal ini ke dalam kuis yang dipilih?`,
      variant: "info",
      confirmText: "Ya, Tambahkan",
      cancelText: "Batal",
    });

    if (!ok) return;

    setPublishing(true);
    try {
      const res = await fetch("/api/admin/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_questions_to_quiz",
          quizId: selectedExistingQuizId,
          questions: draftToAppend.questions,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Soal berhasil ditambahkan ke kuis!");
        setIsAppendModalOpen(false);
      } else {
        toast.error(json.error || "Gagal menambahkan soal.");
      }
    } catch (e) {
      toast.error("Terjadi kendala koneksi.");
    } finally {
      setPublishing(false);
    }
  };

  // If on full-screen /admin/ai-assistant page, do not render floating widget
  if (pathname === "/admin/ai-assistant") {
    return null;
  }

  return (
    <>
      {/* 1. FLOATING ACTION TRIGGER BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            title="Buka VeloNet Admin Copilot"
            aria-label="Buka AI Copilot"
          >
            <Bot className="w-6 h-6 transition-transform group-hover:rotate-6" />
            {/* Sparkle Badge */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400 text-slate-950 items-center justify-center">
                <Sparkles className="w-2.5 h-2.5" />
              </span>
            </span>
          </button>
        </div>
      )}

      {/* 2. FLOATING CHAT WINDOW / RESPONSIVE DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[440px] sm:h-[640px] flex flex-col bg-white sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900">
          {/* Header */}
          <header className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-white">VeloNet Copilot</h3>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {geminiApiKey ? "Gemini 3.6 Flash" : "AI Heuristic"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Admin Control & Quiz Architect</p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsHistoryOpen(!isHistoryOpen);
                  setIsSettingsOpen(false);
                }}
                className={`p-1.5 rounded-lg transition-colors relative ${
                  isHistoryOpen
                    ? "text-blue-400 bg-slate-800"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title="Riwayat Sesi Percakapan"
              >
                <History className="w-4 h-4" />
                {sessions.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 rounded-full bg-blue-600 text-[8px] font-bold text-white min-w-[14px] text-center leading-tight">
                    {sessions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => createNewSession(`Sesi #${sessions.length + 1}`)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Sesi Percakapan Baru"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                  setIsHistoryOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                title="Pengaturan Gemini API Key"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/admin/ai-assistant");
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-colors"
                title="Buka Layar Penuh (Expanded Workspace)"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Tutup Widget"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Settings Overlay Dropdown */}
          {isSettingsOpen && (
            <div className="p-4 bg-slate-800 text-white border-b border-slate-700 animate-in slide-in-from-top-2 duration-150 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Pengaturan Gemini API Key</span>
                </span>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300">
                Masukkan API Key Google Gemini untuk mengaktifkan pemrosesan dokumen PDF/Word tingkat lanjut dan AI multi-format model Flash.
              </p>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white outline-hidden focus:border-blue-400"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition-colors"
                >
                  Simpan
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Dapat diperoleh gratis di Google AI Studio</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Ambil Kunci</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          )}

          {/* Session History Overlay Panel */}
          {isHistoryOpen && (
            <div className="p-3.5 bg-slate-900 text-white border-b border-slate-800 animate-in slide-in-from-top-2 duration-150 space-y-2.5 shrink-0 max-h-[320px] flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-white">Riwayat Percakapan ({sessions.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  {sessions.length > 0 && (
                    <button
                      onClick={handleClearAllSessions}
                      className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Hapus Semua Riwayat Sesi"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Bersihkan</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-1 overflow-y-auto max-h-[190px] pr-1">
                {sessions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    Belum ada riwayat percakapan.
                  </div>
                ) : (
                  sessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          switchSession(s.id);
                          setIsHistoryOpen(false);
                        }}
                        className={`group p-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white font-bold shadow-xs"
                            : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50"
                        }`}
                      >
                        <div className="truncate flex items-center gap-2 flex-1">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                          <span className="truncate">{s.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-blue-700 text-blue-100" : "bg-slate-700 text-slate-400"}`}>
                            {s.messages?.length || 0}
                          </span>
                          <button
                            onClick={(e) => handleDeleteSession(e, s.id, s.title)}
                            className={`p-1 rounded-md transition-colors ${
                              isActive
                                ? "hover:bg-rose-500 text-blue-200 hover:text-white"
                                : "hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            }`}
                            title="Hapus sesi ini"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add New Session Button in Drawer */}
              <button
                onClick={() => {
                  createNewSession(`Sesi #${sessions.length + 1}`);
                  setIsHistoryOpen(false);
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 hover:text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mulai Sesi Baru</span>
              </button>
            </div>
          )}

          {/* Session Switcher Pill */}
          {sessions.length > 1 && (
            <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
              <span className="font-semibold text-slate-500">Sesi Aktif:</span>
              <select
                value={activeSessionId || ""}
                onChange={(e) => switchSession(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 font-medium text-slate-800 outline-hidden max-w-[240px] truncate"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.messages?.length || 0} pesan)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="p-6 text-center text-slate-500 space-y-3 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">VeloNet Master Copilot</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Lampirkan file Word (.docx) atau PDF (.pdf) untuk membuat soal CBT, atau minta saya mengontrol fitur admin VeloNet.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isAI = msg.role === "assistant";
              let parsedDraft: any = null;
              let displayContent = msg.content;

              if (msg.generatedQuizDraft) {
                try {
                  parsedDraft = JSON.parse(msg.generatedQuizDraft);
                } catch (e) {}
              }

              // Auto-clean raw JSON if leaked into content
              if (isAI && msg.content && (msg.content.includes('"reply":') || msg.content.includes('"quizDraft":'))) {
                try {
                  const clean = msg.content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
                  let parsedObj: any = null;
                  for (const sfx of ["", "}", '"}', '"]}', '"}]}', '"}]}}', '}]}', '}]}}', ']}}']) {
                    try {
                      parsedObj = JSON.parse(clean + sfx);
                      if (parsedObj) break;
                    } catch (e) {}
                  }

                  if (parsedObj) {
                    if (parsedObj.reply) displayContent = parsedObj.reply;
                    if (parsedObj.quizDraft && !parsedDraft) parsedDraft = parsedObj.quizDraft;
                  } else {
                    const rMatch = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
                    if (rMatch && rMatch[1]) {
                      displayContent = rMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
                    }
                  }
                } catch (e) {}
              }

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 max-w-[92%] ${isAI ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      isAI
                        ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs"
                        : "bg-slate-800 text-white"
                    }`}
                  >
                    {isAI ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Chat Bubble */}
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-line shadow-xs ${
                        isAI
                          ? "bg-white border border-slate-200 text-slate-800"
                          : "bg-blue-600 text-white font-medium"
                      }`}
                    >
                      {displayContent}
                    </div>

                    {/* Admin Action Button Card */}
                    {msg.adminAction && (
                      <div className="p-3 bg-white border border-blue-200 rounded-2xl shadow-xs space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          Tindakan Cepat Admin
                        </span>
                        {msg.adminAction.type === "navigate" && msg.adminAction.url && (
                          <button
                            onClick={() => {
                              setIsOpen(false);
                              router.push(msg.adminAction.url);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-between border border-blue-200 btn-press transition-colors cursor-pointer"
                          >
                            <span>{msg.adminAction.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Draft Quiz Card */}
                    {parsedDraft && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-slate-800 shadow-md space-y-3">
                        <div>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/80">
                            Draf Soal CBT Multi-Format
                          </span>
                          <h4 className="font-bold text-sm text-white mt-1">
                            {parsedDraft.title}
                          </h4>
                          <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                            {parsedDraft.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                            <span>{parsedDraft.questions?.length || 0} Soal</span>
                            <span>•</span>
                            <span>{parsedDraft.durationMinutes || 30} Menit</span>
                            <span>•</span>
                            <span>PIN: {parsedDraft.supervisorPin}</span>
                          </div>
                        </div>

                        {/* Questions count pills & Bloom preview */}
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Komposisi & Taksonomi Bloom:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedQuizId(expandedQuizId === msg.id ? null : msg.id)}
                              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <span>{expandedQuizId === msg.id ? "Tutup Detail" : "Buka Detail Soal"}</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${expandedQuizId === msg.id ? "rotate-180" : ""}`} />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {parsedDraft.questions?.map((q: any, qIdx: number) => (
                              <div
                                key={qIdx}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-200"
                              >
                                <span className="font-bold">#{qIdx + 1}</span>
                                <span>{q.type}</span>
                                {q.bloomLevel && (
                                  <span className={`px-1 rounded text-[8px] font-black uppercase ${
                                    q.bloomLevel === "C1" ? "bg-blue-600/70 text-blue-100" :
                                    q.bloomLevel === "C2" ? "bg-cyan-600/70 text-cyan-100" :
                                    q.bloomLevel === "C3" ? "bg-emerald-600/70 text-emerald-100" :
                                    q.bloomLevel === "C4" ? "bg-amber-600/70 text-amber-100" :
                                    q.bloomLevel === "C5" ? "bg-purple-600/70 text-purple-100" :
                                    "bg-rose-600/70 text-rose-100"
                                  }`}>
                                    {q.bloomLevel}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Expanded Questions Detail */}
                          {expandedQuizId === msg.id && (
                            <div className="mt-2 pt-2 border-t border-slate-700/80 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                              {parsedDraft.questions?.map((q: any, qIdx: number) => (
                                <div key={qIdx} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-amber-300">Soal #{qIdx + 1} ({q.type})</span>
                                    <div className="flex items-center gap-1">
                                      {q.bloomLevel && (
                                        <span className="px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[9px] font-bold">
                                          Bloom {q.bloomLevel}
                                        </span>
                                      )}
                                      <span className="text-slate-400 font-mono">{q.points || 10} pt</span>
                                    </div>
                                  </div>
                                  {(() => {
                                    const { cleanText, imageUrl } = parseQuestionContent(q.text, q.imageUrl);
                                    return (
                                      <>
                                        <p className="text-slate-200 text-xs font-medium whitespace-pre-line">{cleanText}</p>
                                        {imageUrl && (
                                          <div className="my-1.5 max-w-xs rounded-lg overflow-hidden border border-slate-700 bg-slate-950 p-1">
                                            <img src={imageUrl} alt="Ilustrasi Soal" className="w-full max-h-36 object-contain rounded" />
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {q.diagramSvg && (
                                    <div
                                      className="my-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800 overflow-x-auto"
                                      dangerouslySetInnerHTML={{ __html: q.diagramSvg }}
                                    />
                                  )}
                                  {q.options && q.options.length > 0 && (
                                    <div className="grid grid-cols-1 gap-1 pt-1">
                                      {q.options.map((opt: any, oIdx: number) => (
                                        <div
                                          key={oIdx}
                                          className={`px-2 py-1 rounded-lg text-[10px] flex items-center justify-between ${
                                            opt.isCorrect
                                              ? "bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 font-bold"
                                              : "bg-slate-800/60 text-slate-400"
                                          }`}
                                        >
                                          <span>{String.fromCharCode(65 + oIdx)}. {opt.text}</span>
                                          {opt.isCorrect && <span className="text-[9px] text-emerald-400">✓ Kunci</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {q.sampleAnswer && (
                                    <div className="text-[10px] text-slate-300 italic pt-1 border-t border-slate-800">
                                      <strong>Contoh:</strong> {q.sampleAnswer}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          <button
                            onClick={() => handlePublishQuiz(parsedDraft)}
                            disabled={publishing}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs btn-press transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Terbitkan ke VeloExambro</span>
                          </button>

                          <button
                            onClick={() => handleOpenAppendModal(parsedDraft)}
                            disabled={publishing}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 btn-press transition-colors cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-blue-400" />
                            <span>Masukkan ke Kuis yang Sudah Ada</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 shadow-xs space-y-2">
                  {uploadProgress !== null ? (
                    <div className="space-y-1.5 min-w-[220px] sm:min-w-[270px]">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-800 truncate max-w-[180px]">
                          {uploadProgress < 100
                            ? `Mengunggah berkas (${uploadFileSizeMB} MB)...`
                            : "Gemini Membaca Dokumen..."}
                        </span>
                        <span className="text-blue-600 font-mono font-black">{uploadProgress}%</span>
                      </div>

                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/80">
                        <div
                          className={`h-full transition-all duration-150 ${
                            uploadProgress === 100
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-medium gap-2">
                        {uploadProgress < 100 ? (
                          <>
                            <div className="flex items-center gap-1.5 truncate">
                              <Upload className="w-3.5 h-3.5 text-blue-500 animate-bounce shrink-0" />
                              <span className="truncate">Mengirim {uploadFileName}...</span>
                            </div>
                            <span className="shrink-0 text-slate-400 font-mono">{elapsedSeconds}s</span>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 truncate">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                              <span className="truncate">Gemini 3.5 Flash menganalisis & merancang soal...</span>
                            </div>
                            <span className="shrink-0 text-blue-600 font-mono font-bold">{elapsedSeconds}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                        <span>AI sedang memproses permintaan...</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">{elapsedSeconds}s</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
            {[
              "Berapa total peserta terdaftar?",
              "Buat kuis dari foto/dokumen ini",
              "Arahkan ke pusat ujian CBT",
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 font-medium shrink-0 transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Attached File Preview Badge */}
          {attachedFile && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between text-xs text-blue-900 shrink-0">
              <div className="flex items-center gap-2 truncate">
                {previewImageSrc ? (
                  <img
                    src={previewImageSrc}
                    alt="Preview"
                    className="w-8 h-8 rounded-lg object-cover border border-blue-300 shrink-0 shadow-xs"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-semibold truncate block">{attachedFile.name}</span>
                  <span className="text-[10px] text-blue-500">
                    {(attachedFile.size / 1024).toFixed(1)} KB {previewImageSrc && "• Foto / Scan OCR"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAttachedFile(null)}
                className="p-1 text-blue-500 hover:text-rose-600 cursor-pointer"
                title="Hapus Lampiran"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <footer className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            {/* Hidden file input supporting Word, PDF, and Images */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAttachedFile(e.target.files[0]);
                }
              }}
              accept=".docx,.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                attachedFile
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
              }`}
              title="Lampirkan Dokumen (Word, PDF) atau Gambar (Foto Soal / Scan OCR)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                attachedFile
                  ? "Tulis instruksi tambahan untuk dokumen ini..."
                  : "Tanya AI atau ketik instruksi..."
              }
              disabled={sending}
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900 placeholder-slate-400"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={sending || (!inputText.trim() && !attachedFile)}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Kirim Pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </footer>
        </div>
      )}

      {/* 3. MODAL: INSERT QUESTIONS TO EXISTING QUIZ */}
      {isAppendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Tambahkan ke Kuis yang Sudah Ada</span>
              </h3>
              <button
                onClick={() => setIsAppendModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pilih kuis tujuan untuk memasukkan <strong>{draftToAppend?.questions?.length || 0} soal</strong> baru ini:
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Daftar Kuis Aktif
              </label>
              <select
                value={selectedExistingQuizId}
                onChange={(e) => setSelectedExistingQuizId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 outline-hidden"
              >
                {existingQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q._count?.questions || q.questions?.length || 0} Soal saat ini)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAppendModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAppendQuestions}
                disabled={publishing || !selectedExistingQuizId}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white transition-colors disabled:opacity-50"
              >
                {publishing ? "Menyimpan..." : "Tambahkan Soal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
