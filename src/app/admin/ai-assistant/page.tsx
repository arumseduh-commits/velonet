"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Plus,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sliders,
  MessageSquare,
  ChevronRight,
  ListChecks,
  CheckSquare,
  HelpCircle,
  FileText,
  Trash2,
  Paperclip,
  X,
  ArrowLeft,
  Layers,
  Upload,
  Menu,
  History,
  Image as ImageIcon,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { parseQuestionContent, parseChatMessageAttachment } from "@/lib/question-utils";

export default function AdminAITeacherAssistantPage() {
  const router = useRouter();
  const { toast, confirm } = useDialog();

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Knowledge base topics
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  // Publishing draft quiz state
  const [publishing, setPublishing] = useState(false);

  // Attached file state & API Key
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");

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

  // 1. Initial Load: Sessions & Knowledge Base & API Key
  useEffect(() => {
    fetchSessionsAndMaterials();
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("velonet_gemini_api_key") || "";
      setGeminiApiKey(savedKey);
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

  const fetchSessionsAndMaterials = async () => {
    setLoadingSessions(true);
    try {
      const [resSessions, resKb] = await Promise.all([
        fetch("/api/admin/ai/chat/session"),
        fetch("/api/admin/ai/knowledge-base"),
      ]);

      const jsonSessions = await resSessions.json();
      const jsonKb = await resKb.json();

      if (jsonKb.success && jsonKb.data) {
        setMaterials(jsonKb.data);
      }

      if (jsonSessions.success && jsonSessions.data && jsonSessions.data.length > 0) {
        setSessions(jsonSessions.data);
        setActiveSessionId(jsonSessions.data[0].id);
        setMessages(jsonSessions.data[0].messages || []);
      } else {
        // Create initial default session
        await handleCreateNewSession("Sesi Konsultasi Guru #1");
      }
    } catch (err) {
      toast.error("Gagal memuat sesi chat asisten AI.");
    } finally {
      setLoadingSessions(false);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Switch session
  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages || []);
      setSelectedTopicId(session.contextTopicId || "");
    }
  };

  // Delete single session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string, sessionTitle: string) => {
    e.stopPropagation();

    const ok = await confirm({
      title: "Hapus Sesi Percakapan?",
      message: `Hapus riwayat sesi "${sessionTitle}" beserta seluruh riwayat pesannya secara permanen?`,
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
            handleSelectSession(remaining[0].id);
          } else {
            handleCreateNewSession("Sesi Konsultasi Guru #1");
          }
        }
      } else {
        toast.error(json.error || "Gagal menghapus sesi.");
      }
    } catch (err) {
      toast.error("Terjadi kendala koneksi.");
    }
  };

  // Clear all sessions
  const handleClearAllSessions = async () => {
    const ok = await confirm({
      title: "Hapus Seluruh Riwayat Sesi?",
      message: "Seluruh riwayat obrolan AI akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
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
        toast.success("Seluruh riwayat sesi berhasil dibersihkan!");
        setSessions([]);
        await handleCreateNewSession("Sesi Konsultasi Guru #1");
      } else {
        toast.error(json.error || "Gagal membersihkan riwayat sesi.");
      }
    } catch (err) {
      toast.error("Terjadi kendala koneksi.");
    }
  };

  // Create new chat session
  const handleCreateNewSession = async (title = "Sesi Baru") => {
    try {
      const res = await fetch("/api/admin/ai/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, contextTopicId: selectedTopicId || undefined }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSessions((prev) => [json.data, ...prev]);
        setActiveSessionId(json.data.id);
        setMessages(json.data.messages || []);
        toast.success("Sesi konsultasi baru dibuat.");
      }
    } catch (err) {
      toast.error("Gagal membuat sesi baru.");
    }
  };

  // Send message to AI Assistant
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage.trim();
    if ((!textToSend && !attachedFile) || !activeSessionId || sending) return;

    setInputMessage("");
    const currentFile = attachedFile;
    const currentPreviewUrl = previewImageSrc;
    const isImg = currentFile && (currentFile.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(currentFile.name));
    setAttachedFile(null);
    setSending(true);

    // Optimistically append user message (including image preview URL if image)
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: currentFile
        ? isImg
          ? `📷 [Gambar: ${currentFile.name}|${currentPreviewUrl || ""}]\n${textToSend || "Tolong analisa gambar ini dan buatkan draf soal CBT."}`
          : `📎 [Lampiran: ${currentFile.name}]\n${textToSend || "Tolong analisa dokumen ini dan buatkan draf soal CBT."}`
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
              reject(new Error("Gagal membaca respon server."));
            }
          };

          xhr.onerror = () => reject(new Error("Koneksi gagal saat mengunggah berkas."));
          xhr.send(formData);
        });

        setUploadProgress(null);
      } else {
        const res = await fetch("/api/admin/ai/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            content: textToSend,
            apiKey: geminiApiKey || undefined,
            contextTopicId: selectedTopicId || undefined,
          }),
        });
        json = await res.json();
      }

      if (json.success && json.data) {
        // Sync persistent user message from server (with real /uploads/questions/... url)
        if (json.data.userMessage) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempUserMsg.id
                ? { ...m, id: json.data.userMessage.id, content: json.data.userMessage.content }
                : m
            )
          );
        }

        const aiMsg = {
          id: json.data.messageId || "ai-" + Date.now(),
          role: "assistant",
          content: json.data.reply,
          generatedQuizDraft: json.data.quizDraft ? JSON.stringify(json.data.quizDraft) : null,
          adminAction: json.data.adminAction || null,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Update sessions list with new message count
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: [
                    ...(s.messages || []),
                    json.data.userMessage || tempUserMsg,
                    aiMsg,
                  ],
                }
              : s
          )
        );
      } else {
        toast.error(json.error || "Gagal mendapatkan balasan dari AI.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi ke AI.");
    } finally {
      setUploadProgress(null);
      setSending(false);
    }
  };

  // Publish Draft Quiz to VeloExambro CBT
  const handlePublishDraftQuiz = async (draftPayload: any) => {
    const ok = await confirm({
      title: "Terbitkan ke VeloExambro CBT",
      message: `Terbitkan kuis "${draftPayload.title}" (${draftPayload.questions?.length} soal multi-format) langsung ke sistem ujian CBT VeloExambro?`,
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
        body: JSON.stringify(draftPayload),
      });

      const json = await res.json();
      if (json.success && json.data) {
        toast.success("Kuis CBT berhasil diterbitkan! Membuka Live Control Room...");
        router.push(`/admin/exams/${json.data.quizId}/proctor`);
      } else {
        toast.error(json.error || "Gagal menerbitkan kuis.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan server saat menerbitkan kuis.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-4 pb-6 text-slate-900 relative">
      {/* Mobile Sidebar Backdrop */}
      {showMobileSidebar && (
        <div
          onClick={() => setShowMobileSidebar(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
        />
      )}

      {/* 1. SIDEBAR SESSIONS & KNOWLEDGE BASE (Desktop 3 Cols, Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white shadow-2xl transition-transform duration-200 md:static md:w-80 md:shadow-sm md:rounded-3xl md:border md:border-slate-200 flex flex-col justify-between overflow-hidden shrink-0 ${
          showMobileSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm">Sesi Percakapan</h2>
              <span className="text-[10px] text-slate-400 font-medium">{sessions.length} riwayat</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {sessions.length > 0 && (
              <button
                onClick={handleClearAllSessions}
                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                title="Hapus Semua Riwayat Sesi"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleCreateNewSession(`Sesi #${sessions.length + 1}`)}
              className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors cursor-pointer"
              title="Mulai Sesi Chat Baru"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Knowledge Base Grounding Dropdown */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 space-y-1">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-blue-600" />
            <span>Konteks Knowledge Base</span>
          </label>
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-hidden"
          >
            <option value="">-- Mode Umum (Semua Materi) --</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.category}] {m.title}
              </option>
            ))}
          </select>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingSessions ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-600" />
              Memuat sesi...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p>Belum ada riwayat sesi.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    handleSelectSession(s.id);
                    setShowMobileSidebar(false);
                  }}
                  className={`group w-full p-2.5 rounded-2xl text-left text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isActive
                      ? "bg-blue-50/90 border border-blue-300 text-blue-900 font-bold shadow-xs"
                      : "hover:bg-slate-50 text-slate-700 border border-transparent"
                  }`}
                >
                  <div className="truncate flex items-center gap-2 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? "bg-blue-200/80 text-blue-800" : "bg-slate-100 text-slate-500"}`}>
                      {s.messages?.length || 0}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id, s.title)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                      title="Hapus sesi ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 text-[11px] text-slate-500 bg-slate-50/50 flex items-center justify-between">
          <span>Khusus Akun Guru/Admin</span>
          <Link href="/admin/exams" className="text-blue-600 font-bold hover:underline">
            Pusat CBT &rarr;
          </Link>
        </div>
      </aside>

      {/* 2. CHAT STREAM & COPILOT WORKSPACE */}
      <main className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
        {/* Chat Header */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="Buka Riwayat Sesi"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  VeloNet Master Copilot (Fullscreen)
                </h1>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {geminiApiKey ? "Gemini 3.6 Flash" : "Model Online"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Workspace Penuh: Ekstraksi Word/PDF ke CBT Multi-Format & Kontrol Admin
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali ke Dashboard</span>
          </button>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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
                className={`flex gap-3 max-w-3xl ${isAI ? "mr-auto" : "ml-auto flex-row-reverse"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isAI
                      ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs"
                      : "bg-slate-800 text-white"
                  }`}
                >
                  {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-3 flex-1">
                  <div
                    className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                      isAI
                        ? "bg-slate-50 border border-slate-200/80 text-slate-900"
                        : "bg-blue-600 text-white font-medium"
                    }`}
                  >
                    {isAI ? (
                      displayContent
                    ) : (() => {
                      const { cleanText, attachmentName, attachmentUrl, isImage } = parseChatMessageAttachment(displayContent);
                      return (
                        <div className="space-y-2">
                          {attachmentName && (
                            <div className="space-y-1.5">
                              {isImage && attachmentUrl ? (
                                <div className="rounded-2xl overflow-hidden border border-white/20 bg-black/25 p-1.5">
                                  <img
                                    src={attachmentUrl}
                                    alt={attachmentName}
                                    className="max-h-56 w-auto max-w-full rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(attachmentUrl, "_blank")}
                                    title="Klik untuk melihat ukuran penuh"
                                  />
                                  <div className="flex items-center gap-1.5 mt-1.5 px-1 text-xs text-blue-100 font-normal truncate">
                                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{attachmentName}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/20 text-xs text-blue-100 border border-white/20">
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-xs">{attachmentName}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {cleanText && <div>{cleanText}</div>}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Render Generated Quiz Draft Card if present */}
                  {parsedDraft && (
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                            Draf Soal CBT Multi-Format
                          </span>
                          <h3 className="font-extrabold text-base sm:text-lg text-white mt-1">
                            {parsedDraft.title}
                          </h3>
                          <p className="text-xs text-slate-300 mt-0.5">{parsedDraft.description}</p>
                        </div>

                        <button
                          onClick={() => handlePublishDraftQuiz(parsedDraft)}
                          disabled={publishing}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs btn-press transition-all cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Terbitkan ke VeloExambro</span>
                        </button>
                      </div>

                      {/* Questions Preview in Card */}
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {parsedDraft.questions?.map((q: any, qIdx: number) => (
                          <div
                            key={qIdx}
                            className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-blue-400 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-md bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center text-[10px]">
                                    {qIdx + 1}
                                  </span>
                                  <span>Tipe: {q.type}</span>
                                </span>
                                {q.bloomLevel && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    q.bloomLevel === "C1" ? "bg-blue-600/70 text-blue-100" :
                                    q.bloomLevel === "C2" ? "bg-cyan-600/70 text-cyan-100" :
                                    q.bloomLevel === "C3" ? "bg-emerald-600/70 text-emerald-100" :
                                    q.bloomLevel === "C4" ? "bg-amber-600/70 text-amber-100" :
                                    q.bloomLevel === "C5" ? "bg-purple-600/70 text-purple-100" :
                                    "bg-rose-600/70 text-rose-100"
                                  }`}>
                                    Bloom {q.bloomLevel}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {q.points} Poin
                              </span>
                            </div>

                            {(() => {
                              const { cleanText, imageUrl } = parseQuestionContent(q.text, q.imageUrl);
                              return (
                                <>
                                  <p className="font-semibold text-slate-100 whitespace-pre-line">{cleanText}</p>
                                  {imageUrl && (
                                    <div className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-1.5">
                                      <img
                                        src={imageUrl}
                                        alt="Ilustrasi Soal"
                                        className="w-full max-h-48 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(imageUrl, "_blank")}
                                        title="Klik untuk memperbesar gambar"
                                        onError={(e) => {
                                          (e.currentTarget.parentElement as HTMLElement)?.classList.add("hidden");
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* Scientific / Visual Diagram if generated */}
                            {q.diagramSvg && (
                              <div
                                className="my-2 p-2 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto"
                                dangerouslySetInnerHTML={{ __html: q.diagramSvg }}
                              />
                            )}

                            {/* Options for Choice / Checkbox / True False */}
                            {q.options && q.options.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {q.options.map((opt: any, optIdx: number) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  return (
                                    <div
                                      key={optIdx}
                                      className={`p-2 rounded-xl text-[11px] flex items-center justify-between border ${
                                        opt.isCorrect
                                          ? "bg-emerald-950/60 border-emerald-500/80 text-emerald-300 font-bold"
                                          : "bg-slate-900/60 border-slate-700/60 text-slate-300"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center text-[9px] font-bold">
                                          {letter}
                                        </span>
                                        <span>{opt.text}</span>
                                      </div>
                                      {opt.isCorrect && (
                                        <span className="text-[9px] text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded-sm">
                                          Kunci Benar
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Rubric for Short Answer or Essay */}
                            {q.sampleAnswer && (
                              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                                <div className="font-bold text-amber-400">Contoh Jawaban Ideal:</div>
                                <p className="italic text-slate-200">{q.sampleAnswer}</p>
                                {q.gradingRubric && (
                                  <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400 whitespace-pre-line">
                                    <strong>Panduan Rubrik:</strong> {q.gradingRubric}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-700 shadow-xs space-y-2">
                {uploadProgress !== null ? (
                  <div className="space-y-1.5 min-w-[240px] sm:min-w-[300px]">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-800 truncate max-w-[200px]">
                        {uploadProgress < 100
                          ? `Mengunggah berkas (${uploadFileSizeMB} MB)...`
                          : "Gemini Membaca Dokumen..."}
                      </span>
                      <span className="text-blue-600 font-mono font-black">{uploadProgress}%</span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/60">
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
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                      <span>AI Assistant sedang memproses & menyusun jawaban...</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">{elapsedSeconds}s</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 shrink-0 font-bold">Ide Cepat:</span>
          {[
            "Buat 5 soal pilihan ganda & 2 soal uraian tentang Degrees of Comparison",
            "Buatkan soal CBT multi-tipe (Pilihan Ganda, Checkbox, True/False, Essay)",
            "Susun rubrik penilaian essay tata bahasa Bahasa Inggris",
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-medium shrink-0 transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Attached File Preview Pill */}
        {attachedFile && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2 truncate">
              {previewImageSrc ? (
                <img
                  src={previewImageSrc}
                  alt="Preview"
                  className="w-9 h-9 rounded-lg object-cover border border-blue-300 shrink-0 shadow-xs"
                />
              ) : (
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <div className="truncate">
                <span className="font-semibold truncate block">{attachedFile.name}</span>
                <span className="text-[10px] text-blue-500">
                  ({(attachedFile.size / 1024).toFixed(1)} KB) {previewImageSrc && "• Foto / Scan OCR"}
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-4 border-t border-slate-100 flex items-center gap-3 bg-white"
        >
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
            className={`p-3 rounded-2xl border transition-colors cursor-pointer shrink-0 ${
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
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              attachedFile
                ? "Tulis instruksi tambahan untuk dokumen ini..."
                : "Ketik instruksi ke AI (contoh: Buatkan 5 soal pilihan ganda dan 2 uraian...)"
            }
            disabled={sending}
            className="flex-1 px-4 py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900 placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={sending || (!inputMessage.trim() && !attachedFile)}
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      </main>
    </div>
  );
}
