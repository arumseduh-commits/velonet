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
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export function AdminFloatingChat() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, confirm } = useDialog();

  // Floating Window State
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // Publishing / Adding questions state
  const [publishing, setPublishing] = useState(false);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [selectedExistingQuizId, setSelectedExistingQuizId] = useState<string>("");
  const [isAppendModalOpen, setIsAppendModalOpen] = useState(false);
  const [draftToAppend, setDraftToAppend] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API Key from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("velonet_gemini_api_key") || "";
      setGeminiApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

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
      let res: Response;

      if (currentFile) {
        // Send multipart form data
        const formData = new FormData();
        formData.append("sessionId", activeSessionId);
        formData.append("content", textToSend);
        formData.append("file", currentFile);
        if (geminiApiKey) formData.append("apiKey", geminiApiKey);

        res = await fetch("/api/admin/ai/chat/message", {
          method: "POST",
          body: formData,
        });
      } else {
        // Send JSON
        res = await fetch("/api/admin/ai/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            content: textToSend,
            apiKey: geminiApiKey || undefined,
          }),
        });
      }

      const json = await res.json();
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
    } catch (err) {
      toast.error("Terjadi kendala koneksi ke server Copilot.");
    } finally {
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
                onClick={() => createNewSession(`Sesi #${sessions.length + 1}`)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Sesi Percakapan Baru"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
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
              if (msg.generatedQuizDraft) {
                try {
                  parsedDraft = JSON.parse(msg.generatedQuizDraft);
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
                      {msg.content}
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

                        {/* Questions count pills */}
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] space-y-1">
                          <div className="font-semibold text-slate-300">Komposisi Soal:</div>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {parsedDraft.questions?.map((q: any, qIdx: number) => (
                              <span
                                key={qIdx}
                                className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-200 font-medium"
                              >
                                #{qIdx + 1}: {q.type}
                              </span>
                            ))}
                          </div>
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
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>AI sedang menganalisis & merumuskan respons...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
            {[
              "Berapa total peserta terdaftar?",
              "Arahkan ke pusat ujian CBT",
              "Buat kuis dari materi yang dilampirkan",
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
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-semibold truncate">{attachedFile.name}</span>
                <span className="text-[10px] text-blue-500 shrink-0">
                  ({(attachedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => setAttachedFile(null)}
                className="p-1 text-blue-500 hover:text-rose-600"
                title="Hapus Lampiran"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <footer className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAttachedFile(e.target.files[0]);
                }
              }}
              accept=".docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
              title="Lampirkan Dokumen (Word .docx atau PDF)"
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
