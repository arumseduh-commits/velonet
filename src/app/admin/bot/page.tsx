"use client";

import { useEffect, useState, useRef } from "react";
import { BotConnectionState, BotStatus } from "@/lib/bot-engine";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  Bot,
  QrCode,
  LogOut,
  Play,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Smartphone,
  Send,
  Users,
  Search,
  Check,
  UserX,
  Clock,
  Sparkles,
  ShieldAlert,
  UserPlus,
  ShieldOff,
  UserCheck,
  FileText,
  Upload,
  Star,
  Link as LinkIcon,
  ExternalLink,
  Lock,
  Unlock,
  ShieldCheck,
} from "lucide-react";

interface LogItem {
  message: string;
  time: string;
}

interface SavedGroup {
  id: string;
  subject: string;
  size: number;
}

interface GroupMember {
  id: string | null;
  jid: string;
  pnJid?: string | null;
  phoneNumber: string;
  isLid?: boolean;
  name: string | null;
  studentClass: string | null;
  status: string;
  isExcluded: boolean;
  isKickedFromGrp: boolean;
  lastSentAt: string | null;
}

interface GroupInfo {
  groupId: string;
  groupSubject: string;
  totalMembers: number;
  members: GroupMember[];
}

interface ExclusionItem {
  id: string;
  phoneNumber: string;
  name: string | null;
  createdAt: string;
}

interface PrimaryGroupInfo {
  id: string | null;
  name: string | null;
  inviteLink: string | null;
}

export default function BotControlPage() {
  const { confirm, toast } = useDialog();
  const [status, setStatus] = useState<BotStatus>({
    state: "DISCONNECTED",
    qrCodeUrl: null,
    userInfo: null,
    lastError: null,
  });
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Primary Official Group & Registration Strict Mode State
  const [primaryGroup, setPrimaryGroup] = useState<PrimaryGroupInfo>({
    id: null,
    name: null,
    inviteLink: null,
  });
  const [primaryInviteInput, setPrimaryInviteInput] = useState("");
  const [savingPrimaryGroup, setSavingPrimaryGroup] = useState(false);
  const [fetchingInviteLink, setFetchingInviteLink] = useState(false);

  // Group Inspector & Dropdown State
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [inputGroupJid, setInputGroupJid] = useState<string>("");
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);
  const [groupData, setGroupData] = useState<GroupInfo | null>(null);
  const [sendingSingleMember, setSendingSingleMember] = useState<string | null>(null);
  const [inspectorMsg, setInspectorMsg] = useState<string | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [exclusionSearchQuery, setExclusionSearchQuery] = useState("");
  const [groupDropdownSearch, setGroupDropdownSearch] = useState("");

  // Exclusion List State & Modal State
  const [exclusions, setExclusions] = useState<ExclusionItem[]>([]);
  const [newExclusionPhone, setNewExclusionPhone] = useState("");
  const [newExclusionName, setNewExclusionName] = useState("");
  const [addingExclusion, setAddingExclusion] = useState(false);
  const [excludeModalMember, setExcludeModalMember] = useState<{
    phone: string;
    name: string;
  } | null>(null);
  const [excludingMember, setExcludingMember] = useState(false);

  // Bulk Import State
  const [importRawText, setImportRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [broadcastingUncontacted, setBroadcastingUncontacted] = useState(false);

  // Pairing Code Login State
  const [loginMode, setLoginMode] = useState<"QR" | "PAIRING">("QR");
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);

  // Join Group via Invite Link State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [joiningGroup, setJoiningGroup] = useState(false);

  const handleJoinGroupViaInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUrl.trim()) return;

    setJoiningGroup(true);
    try {
      const res = await fetch("/api/bot/join-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteUrl: inviteUrl.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Bot berhasil bergabung ke grup WhatsApp!");
        setInviteUrl("");
        setShowJoinModal(false);
        fetchSavedGroupsList();
      } else {
        toast.error(json.error || "Gagal bergabung ke grup.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setJoiningGroup(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setRequestingPairingCode(true);
    setPairingCodeResult(null);
    try {
      const res = await fetch("/api/bot/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_pairing_code",
          phoneNumber: pairingPhone.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && json.pairingCode) {
        setPairingCodeResult(json.pairingCode);
        toast.success(`Kode Pasangan WhatsApp: ${json.pairingCode}`);
      } else {
        toast.error(json.error || "Gagal menghasilkan Kode Pasangan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setRequestingPairingCode(false);
    }
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRawText.trim()) return;
    setImporting(true);
    setInspectorMsg(null);
    try {
      const res = await fetch("/api/participants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: importRawText }),
      });
      const json = await res.json();
      if (json.success) {
        setInspectorMsg(`✅ ${json.message}`);
        toast.success(json.message || "Impor nomor berhasil!");
        setImportRawText("");
        if (inputGroupJid) fetchMembersForJid(inputGroupJid);
      } else {
        toast.error(`Gagal impor: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleBroadcastAllUncontacted = async () => {
    const confirmed = await confirm({
      title: "Broadcast Anggota Belum Dikontak",
      message: "Kirim pesan konfirmasi pendaftaran secara personal (DM) ke SEMUA nomor HP hasil impor yang belum dikontak?",
      confirmText: "Ya, Broadcast DM",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!confirmed) return;

    setBroadcastingUncontacted(true);
    setInspectorMsg(null);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_all_uncontacted",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setInspectorMsg(json.message);
        toast.success(json.message);
        if (inputGroupJid) fetchMembersForJid(inputGroupJid);
      } else {
        setInspectorMsg(`Gagal: ${json.error}`);
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      setInspectorMsg(`Error: ${err.message}`);
      toast.error(`Error: ${err.message}`);
    } finally {
      setBroadcastingUncontacted(false);
    }
  };

  const fetchedInitialGroupsRef = useRef(false);

  useEffect(() => {
    // Connect to Server-Sent Events stream
    const eventSource = new EventSource("/api/bot/status?stream=true");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "status") {
          setStatus(payload.data);
          if (payload.data.state === "CONNECTED" && !fetchedInitialGroupsRef.current) {
            fetchedInitialGroupsRef.current = true;
            fetchSavedGroupsList();
          }
        } else if (payload.type === "log") {
          setLogs((prev) => [...prev.slice(-100), payload.data]); // Keep last 100 log items
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    fetchSavedGroupsList();
    fetchExclusions();

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch list of exclusions
  const fetchExclusions = async () => {
    try {
      const res = await fetch("/api/exclusions");
      const json = await res.json();
      if (json.success && json.data) {
        setExclusions(json.data);
      }
    } catch (e) {}
  };

  const handleAddExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExclusionPhone) return;
    setAddingExclusion(true);
    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newExclusionPhone,
          name: newExclusionName || "Pembina / Admin",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNewExclusionPhone("");
        setNewExclusionName("");
        toast.success("Nomor pengecualian berhasil ditambahkan.");
        fetchExclusions();
        if (inputGroupJid) fetchMembersForJid(inputGroupJid);
      } else {
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setAddingExclusion(false);
    }
  };

  const filteredSavedGroups = savedGroups.filter((g) => {
    if (!groupDropdownSearch.trim()) return true;
    const q = groupDropdownSearch.toLowerCase().trim();
    return (
      (g.subject || "").toLowerCase().includes(q) ||
      (g.id || "").toLowerCase().includes(q)
    );
  });

  function formatDisplayPhoneNumber(raw: string): string {
    if (!raw) return "-";
    let cleaned = raw.replace(/\D/g, "");
    
    // Detect raw LID format (starts with 1, 2, 69, 82, 91 and has length >= 14)
    if (cleaned.length >= 14 && !cleaned.startsWith("62") && !cleaned.startsWith("0")) {
      return `ID Privat WA (LID: ${cleaned.slice(0, 4)}...${cleaned.slice(-4)})`;
    }

    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    }
    if (cleaned.startsWith("62")) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  }

  const handleExcludeMemberDirect = async (phone: string, name?: string | null) => {
    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          name: name || "Anggota Grup Dikecualikan",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Anggota berhasil dikecualikan.");
        fetchExclusions();
        if (inputGroupJid) fetchMembersForJid(inputGroupJid);
      } else {
        toast.error(`Gagal mengecualikan: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleRemoveExclusion = async (id: string) => {
    try {
      const res = await fetch(`/api/exclusions?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pengecualian berhasil dihapus.");
        fetchExclusions();
        if (inputGroupJid) fetchMembersForJid(inputGroupJid);
      }
    } catch (e) {}
  };

  // Fetch list of saved groups for dropdown & primary group setting
  const fetchSavedGroupsList = async () => {
    try {
      const res = await fetch("/api/bot/groups");
      const json = await res.json();
      if (json.success) {
        if (Array.isArray(json.data)) {
          setSavedGroups(json.data);
        }
        if (json.primaryGroup) {
          setPrimaryGroup(json.primaryGroup);
          if (json.primaryGroup.inviteLink) {
            setPrimaryInviteInput(json.primaryGroup.inviteLink);
          }
        }

        const savedJid = typeof window !== "undefined" ? localStorage.getItem("velo_selected_group_jid") : null;
        const targetJid =
          savedJid && json.data?.some((g: any) => g.id === savedJid)
            ? savedJid
            : json.primaryGroup?.id
            ? json.primaryGroup.id
            : json.data?.length > 0
            ? json.data[0].id
            : "";

        if (targetJid) {
          setInputGroupJid(targetJid);
          fetchMembersForJid(targetJid);
        }
      }
    } catch (e) {}
  };

  const fetchMembersForJid = async (jidToFetch: string) => {
    if (!jidToFetch) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("velo_selected_group_jid", jidToFetch);
    }
    setLoadingGroupMembers(true);
    setInspectorMsg(null);
    try {
      const res = await fetch(`/api/bot/groups?groupId=${encodeURIComponent(jidToFetch)}`);
      const json = await res.json();
      if (json.success) {
        setGroupData(json.data);
        if (json.primaryGroup) {
          setPrimaryGroup(json.primaryGroup);
          if (json.primaryGroup.inviteLink && !primaryInviteInput) {
            setPrimaryInviteInput(json.primaryGroup.inviteLink);
          }
        }
      } else {
        setInspectorMsg(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      setInspectorMsg(`Error: ${err.message}`);
    } finally {
      setLoadingGroupMembers(false);
    }
  };

  // Primary Group Management Handlers
  const handleSetPrimaryGroup = async (groupJid: string, groupSubject?: string) => {
    const confirmed = await confirm({
      title: "Tetapkan Sebagai Grup Utama Resmi",
      message: `Jadikan "${groupSubject || groupJid}" sebagai Grup Utama Resmi Velocity?\n\nNomor baru yang belum bergabung ke grup ini TIDAK AKAN dapat mendaftar sebelum bergabung ke grup WhatsApp ini.`,
      confirmText: "Ya, Tetapkan Grup Utama",
      cancelText: "Batal",
      variant: "info",
      icon: "info",
    });

    if (!confirmed) return;

    setSavingPrimaryGroup(true);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_primary_group",
          groupId: groupJid,
          groupSubject: groupSubject || "Grup Komunitas Velocity",
          inviteLink: primaryInviteInput.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Grup Utama resmi berhasil ditetapkan!");
        if (json.primaryGroup) {
          setPrimaryGroup(json.primaryGroup);
          if (json.primaryGroup.inviteLink) {
            setPrimaryInviteInput(json.primaryGroup.inviteLink);
          }
        }
      } else {
        toast.error(json.error || "Gagal menetapkan grup utama.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSavingPrimaryGroup(false);
    }
  };

  const handleSaveInviteLink = async () => {
    if (!primaryInviteInput.trim()) {
      toast.warning("Masukkan link undangan grup WhatsApp terlebih dahulu.");
      return;
    }
    setSavingPrimaryGroup(true);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_invite_link",
          inviteLink: primaryInviteInput.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Link undangan grup WhatsApp berhasil disimpan!");
        setPrimaryGroup((prev) => ({ ...prev, inviteLink: primaryInviteInput.trim() }));
      } else {
        toast.error(json.error || "Gagal menyimpan link undangan.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSavingPrimaryGroup(false);
    }
  };

  const handleAutoFetchInviteLink = async () => {
    if (status.state !== "CONNECTED") {
      toast.error("Bot belum terhubung! Silakan aktifkan bot terlebih dahulu.");
      return;
    }
    setFetchingInviteLink(true);
    try {
      const targetGid = primaryGroup.id || inputGroupJid;
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_group_invite_link",
          groupId: targetGid || undefined,
        }),
      });
      const json = await res.json();
      if (json.success && json.inviteLink) {
        setPrimaryInviteInput(json.inviteLink);
        setPrimaryGroup((prev) => ({ ...prev, inviteLink: json.inviteLink }));
        toast.success("Link undangan grup berhasil ditarik otomatis dari WhatsApp!");
      } else {
        toast.error(json.error || "Gagal menarik link undangan grup.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setFetchingInviteLink(false);
    }
  };

  const handleUnsetPrimaryGroup = async () => {
    const confirmed = await confirm({
      title: "Nonaktifkan Mode Validasi Grup",
      message: "Apakah Anda yakin ingin menonaktifkan validasi grup? Nomor baru akan diizinkan mendaftar secara bebas tanpa wajib bergabung ke grup WhatsApp terlebih dahulu.",
      confirmText: "Ya, Buka Pendaftaran Bebas",
      cancelText: "Batal",
      variant: "warning",
      icon: "warning",
    });

    if (!confirmed) return;

    setSavingPrimaryGroup(true);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unset_primary_group" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pengaturan Grup Utama dinonaktifkan (Mode Pendaftaran Terbuka).");
        setPrimaryGroup({ id: null, name: null, inviteLink: null });
        setPrimaryInviteInput("");
      } else {
        toast.error(json.error || "Gagal menonaktifkan grup utama.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSavingPrimaryGroup(false);
    }
  };

  const handleFetchGroupMembersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchMembersForJid(inputGroupJid);
  };

  // Send confirmation DM to a single member
  const handleSendSingleMember = async (phoneNumber: string, targetJid?: string) => {
    if (status.state !== "CONNECTED") {
      toast.error("Bot belum terhubung! Silakan klik 'Mulai Service Bot' atau tautkan WhatsApp terlebih dahulu.");
      return;
    }
    setSendingSingleMember(phoneNumber);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_member_confirmation",
          targetJid: targetJid || phoneNumber,
          phoneNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Pesan konfirmasi dikirim ke +${phoneNumber}`);
        // Refresh member list
        await fetchMembersForJid(inputGroupJid);
      } else {
        toast.error(`Gagal mengirim ke +${phoneNumber}: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSendingSingleMember(null);
    }
  };

  const handleStartBot = async () => {
    setActionLoading(true);
    try {
      await fetch("/api/bot/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      toast.info("Memulai koneksi bot WhatsApp...");
    } catch (err) {
      console.error("Failed to trigger bot start:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogoutBot = async () => {
    const confirmed = await confirm({
      title: "Logout Sesi Bot",
      message: "Apakah Anda yakin ingin melakukan Logout Sesi Bot? Sesi di database akan dihapus dan Anda perlu melakukan Scan QR ulang.",
      confirmText: "Ya, Logout Bot",
      cancelText: "Batal",
      variant: "danger",
      icon: "warning",
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      await fetch("/api/bot/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      toast.success("Sesi bot WhatsApp berhasil di-logout.");
      setLogs((prev) => [
        ...prev,
        { message: "Bot session logged out manually by admin.", time: new Date().toLocaleTimeString() },
      ]);
      setGroupData(null);
      setSavedGroups([]);
    } catch (err) {
      console.error("Failed to logout bot:", err);
      toast.error("Gagal melakukan logout bot.");
    } finally {
      setActionLoading(false);
    }
  };

  const clearConsoleLogs = () => {
    setLogs([]);
  };

  const getStatusBadge = (statusStr: string, isExcluded: boolean) => {
    if (isExcluded) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-amber-400" /> DIKECUALIKAN
        </span>
      );
    }

    switch (statusStr) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> COMPLETED (Lanjut)
          </span>
        );
      case "OPTED_OUT":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold inline-flex items-center gap-1">
            <UserX className="w-3 h-3" /> OPTED OUT (Menolak)
          </span>
        );
      case "WAITING_CONFIRMATION":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> WAITING CONFIRMATION
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
            BELUM DIKONTAK
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-slate-900 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Bot Control Center & Exclusion List <Bot className="w-6 h-6 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manajemen bot WhatsApp, inspeksi grup, daftar pengecualian (Exclusion List), dan live logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status.state === "CONNECTED" && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>➕ Gabungkan Bot via Link Undangan</span>
            </button>
          )}

          {status.state !== "CONNECTED" && (
            <button
              onClick={handleStartBot}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>{status.state === "CONNECTING" ? "Restart Engine" : "Mulai Service Bot"}</span>
            </button>
          )}

          <button
            onClick={handleLogoutBot}
            disabled={actionLoading || status.state === "DISCONNECTED"}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Sesi Bot</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Status & Group Inspector Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Connection Status Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Status Koneksi Saat Ini
            </h3>

            <div className="flex items-center gap-3">
              {status.state === "CONNECTED" && (
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              )}
              {status.state === "CONNECTING" && (
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              )}
              {status.state === "DISCONNECTED" && (
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}

              <div>
                <div className="font-extrabold text-lg text-slate-900">
                  {status.state === "CONNECTED" && "Terkoneksi (Connected)"}
                  {status.state === "CONNECTING" && "Menghubungkan / Scan QR"}
                  {status.state === "DISCONNECTED" && "Terputus (Disconnected)"}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {status.userInfo
                    ? `Akun: ${status.userInfo.name || "Bot"} (+${status.userInfo.id.split(":")[0]})`
                    : "Sesi WhatsApp Bot"}
                </p>
              </div>
            </div>

            {status.lastError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                Log Terakhir: {status.lastError}
              </div>
            )}
          </div>

          {/* Primary Official Group & Registration Strict Mode Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Grup Utama & Validasi Pendaftaran
              </h3>
              {primaryGroup.id ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Strict Mode
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Open Mode
                </span>
              )}
            </div>

            {primaryGroup.id ? (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>{primaryGroup.name || "Grup Komunitas Velocity"}</span>
                      </p>
                      <p className="text-[11px] font-mono text-emerald-700 mt-0.5 break-all">
                        {primaryGroup.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUnsetPrimaryGroup}
                      disabled={savingPrimaryGroup}
                      className="px-2 py-1 text-[10px] font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                      title="Kembalikan ke pendaftaran terbuka tanpa validasi grup"
                    >
                      Buka Bebas
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    🔒 <b>Aturan Aktif:</b> Nomor baru yang belum ada di grup ini akan <b>ditolak saat mendaftar</b> dan otomatis dikirimi link undangan grup WhatsApp di bawah.
                  </p>
                </div>

                {/* Invite Link Form */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Link Undangan Grup WhatsApp (Invite Link):
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="https://chat.whatsapp.com/..."
                        value={primaryInviteInput}
                        onChange={(e) => setPrimaryInviteInput(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoFetchInviteLink}
                        disabled={fetchingInviteLink || status.state !== "CONNECTED"}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                        title="Tarik link invite resmi secara otomatis via koneksi WhatsApp Bot"
                      >
                        {fetchingInviteLink ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                        <span>Tarik dari WA</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInviteLink}
                        disabled={savingPrimaryGroup || !primaryInviteInput.trim()}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {savingPrimaryGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Simpan Link</span>
                      </button>
                    </div>
                  </div>
                  {primaryGroup.inviteLink && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-500 shrink-0">Link Aktif:</span>
                      <a
                        href={primaryGroup.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 font-mono truncate"
                      >
                        {primaryGroup.inviteLink} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-left">
                <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Mode Pendaftaran Terbuka (Open)
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Belum ada Grup Utama yang ditetapkan. Nomor baru dari luar grup saat ini tetap bisa mendaftar. Untuk mewajibkan calon siswa masuk grup WhatsApp terlebih dahulu, pilih grup pada menu inspeksi lalu klik <b>"Jadikan Grup Utama Resmi"</b>.
                </p>
              </div>
            )}
          </div>

          {/* Group JID Inspector Card */}
          {status.state === "CONNECTED" && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Inspeksi Anggota Grup WhatsApp
              </h3>

              {inspectorMsg && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs leading-relaxed">
                  {inspectorMsg}
                </div>
              )}

              {/* Saved Groups Dropdown with Real-Time Search */}
              {savedGroups.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Pilih Grup Terdeteksi ({savedGroups.length} Grup):
                    </label>
                  </div>

                  {/* Search Bar for Groups */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama grup WA..."
                      value={groupDropdownSearch}
                      onChange={(e) => setGroupDropdownSearch(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {groupDropdownSearch && (
                      <button
                        onClick={() => setGroupDropdownSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={inputGroupJid}
                    onChange={(e) => {
                      setInputGroupJid(e.target.value);
                      fetchMembersForJid(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Grup ({filteredSavedGroups.length} terurai) --</option>
                    {filteredSavedGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.subject} ({g.size} Anggota) - {g.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <form onSubmit={handleFetchGroupMembersSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {savedGroups.length > 0 ? "Atau Masukkan Group JID Baru:" : "Masukkan Group JID *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="120363041234567890@g.us"
                    value={inputGroupJid}
                    onChange={(e) => setInputGroupJid(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingGroupMembers || !inputGroupJid}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingGroupMembers ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{loadingGroupMembers ? "Membaca Anggota Grup..." : "Ambil & Pindai Anggota Grup"}</span>
                </button>
              </form>
            </div>
          )}

          {/* Unified Exclusion List Quick Add Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Tambah Nomor Pengecualian (Exclusion)
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Nomor yang ditambahkan di sini (contoh: Pembina, Admin, Pengawas) **tidak akan pernah di-chat atau di-broadcast** oleh bot.
            </p>

            <form onSubmit={handleAddExclusion} className="space-y-3">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Nomor WA (contoh: 08123456789)"
                  value={newExclusionPhone}
                  onChange={(e) => setNewExclusionPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Nama / Jabatan (contoh: Pak Guru Pembina)"
                  value={newExclusionName}
                  onChange={(e) => setNewExclusionName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={addingExclusion || !newExclusionPhone}
                className="w-full py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {addingExclusion ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>Tambah ke Exclusion List</span>
              </button>
            </form>
          </div>

          {/* QR Code & Pairing Code Login Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-center">
            {status.state === "CONNECTED" ? (
              <div className="py-3 space-y-1 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Sesi Terhubung & Tersimpan Permanen</h4>
                <p className="text-[11px] text-slate-500">
                  Bot terhubung sebagai: <b className="text-emerald-700">+{status.userInfo?.id.split(":")[0]}</b>
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    onClick={() => setLoginMode("QR")}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      loginMode === "QR"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    📷 Scan QR Code
                  </button>
                  <button
                    onClick={() => setLoginMode("PAIRING")}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      loginMode === "PAIRING"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🔑 Kode 8-Angka (Tanpa Kamera)
                  </button>
                </div>

                {loginMode === "QR" ? (
                  status.qrCodeUrl ? (
                    <div className="space-y-4 flex flex-col items-center">
                      <div className="p-3 bg-white rounded-2xl shadow-md border-4 border-blue-100 inline-block">
                        <img
                          src={status.qrCodeUrl}
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 object-contain"
                        />
                      </div>
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl max-w-xs leading-relaxed">
                        Buka WhatsApp di HP ➔ Perangkat Tertaut ➔ Tautkan Perangkat ➔ Scan QR di atas.
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 space-y-2 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <Bot className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-700 text-sm">Mempersiapkan QR Code...</h4>
                      <p className="text-xs text-slate-500">Klik "Mulai Service Bot" di atas jika belum berjalan</p>
                    </div>
                  )
                ) : (
                  <form onSubmit={handleRequestPairingCode} className="space-y-4 text-left">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nomor WhatsApp Bot (Awali 08 / 62)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 08123456789"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={requestingPairingCode || !pairingPhone.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {requestingPairingCode ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Smartphone className="w-4 h-4" />
                      )}
                      <span>{requestingPairingCode ? "Meminta Kode..." : "Dapatkan Kode Tautan (Pairing Code)"}</span>
                    </button>

                    {pairingCodeResult && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-center animate-in fade-in duration-200">
                        <p className="text-xs text-emerald-800 font-medium">Kode Pasangan WhatsApp Anda:</p>
                        <div className="text-2xl font-extrabold text-emerald-900 font-mono tracking-widest bg-white py-2 rounded-xl border border-emerald-300 select-all shadow-xs">
                          {pairingCodeResult}
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed pt-1">
                          💡 <b>Langkah Tautkan di HP:</b> Buka WA ➔ Perangkat Tertaut ➔ Tautkan Perangkat ➔ <b>"Tautkan dengan Nomor Telepon"</b> ➔ Masukkan kode di atas!
                        </p>
                      </div>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Side: Group Members Datatable & Exclusion List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Render Group Members Table if Group Data is Loaded */}
          {groupData ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    {groupData.groupSubject} <Sparkles className="w-4 h-4 text-amber-500" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    {groupData.groupId} • {groupData.totalMembers} Anggota
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {primaryGroup.id === groupData.groupId ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Grup Utama Resmi Aktif ✅</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryGroup(groupData.groupId, groupData.groupSubject)}
                      disabled={savingPrimaryGroup}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingPrimaryGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                      <span>Jadikan Grup Utama Resmi</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar for Group Members */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Cari anggota grup berdasarkan nomor WhatsApp atau nama..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {groupSearchQuery && (
                  <button
                    onClick={() => setGroupSearchQuery("")}
                    className="text-[10px] text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-md bg-white border border-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Members Table */}
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">No. WhatsApp / JID</th>
                      <th className="py-3 px-3">Nama</th>
                      <th className="py-3 px-3">Status Pendaftaran</th>
                      <th className="py-3 px-3 text-right">Aksi Kirim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                    {groupData.members.filter((m) => {
                      if (!groupSearchQuery.trim()) return true;
                      const q = groupSearchQuery.toLowerCase().trim();
                      const phone = (m.phoneNumber || "").toLowerCase();
                      const name = (m.name || "").toLowerCase();
                      return phone.includes(q) || name.includes(q);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                          Tidak ditemukan anggota grup yang cocok dengan "{groupSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      groupData.members
                        .filter((m) => {
                          if (!groupSearchQuery.trim()) return true;
                          const q = groupSearchQuery.toLowerCase().trim();
                          const phone = (m.phoneNumber || "").toLowerCase();
                          const name = (m.name || "").toLowerCase();
                          return phone.includes(q) || name.includes(q);
                        })
                        .map((m) => (
                      <tr key={m.phoneNumber} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">
                          {formatDisplayPhoneNumber(m.phoneNumber)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {m.name || <span className="text-slate-400 font-normal">-</span>}
                        </td>
                        <td className="py-3 px-3">
                          {getStatusBadge(m.status, m.isExcluded)}
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleSendSingleMember(m.phoneNumber, m.jid)}
                            disabled={
                              sendingSingleMember === m.phoneNumber ||
                              m.status === "COMPLETED" ||
                              m.isExcluded
                            }
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                              m.status === "OPTED_OUT"
                                ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {sendingSingleMember === m.phoneNumber ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>
                              {m.status === "WAITING_CONFIRMATION"
                                ? "Kirim Ulang"
                                : m.status === "COMPLETED"
                                ? "Selesai"
                                : m.status === "OPTED_OUT"
                                ? "Resend Konfirmasi"
                                : "Kirim Pesan"}
                            </span>
                          </button>

                          {!m.isExcluded && (
                            <button
                              onClick={() =>
                                setExcludeModalMember({
                                  phone: m.phoneNumber,
                                  name: m.name || "",
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-amber-700 border border-amber-200"
                              title="Kecualikan nomor ini dan tambahkan nama/jabatan"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Kecualikan</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Unified Exclusion List Table Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Daftar Pengecualian Aktif ({exclusions.length} Nomor)
                </h3>
              </div>

              <button
                onClick={fetchExclusions}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs cursor-pointer border border-slate-200"
                title="Refresh Exclusion List"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Bar for Exclusion List */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari nomor HP atau nama di daftar pengecualian..."
                value={exclusionSearchQuery}
                onChange={(e) => setExclusionSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {exclusionSearchQuery && (
                <button
                  onClick={() => setExclusionSearchQuery("")}
                  className="text-[10px] text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-md bg-white border border-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-[220px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">No. WhatsApp</th>
                    <th className="py-2.5 px-3">Nama / Jabatan</th>
                    <th className="py-2.5 px-3 text-right">Aksi Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {exclusions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                        Belum ada nomor yang dikecualikan.
                      </td>
                    </tr>
                  ) : exclusions.filter((item) => {
                      if (!exclusionSearchQuery.trim()) return true;
                      const q = exclusionSearchQuery.toLowerCase().trim();
                      const phone = (item.phoneNumber || "").toLowerCase();
                      const name = (item.name || "").toLowerCase();
                      return phone.includes(q) || name.includes(q);
                    }).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 text-xs">
                        Tidak ditemukan nomor pengecualian yang cocok dengan "{exclusionSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    exclusions
                      .filter((item) => {
                        if (!exclusionSearchQuery.trim()) return true;
                        const q = exclusionSearchQuery.toLowerCase().trim();
                        const phone = (item.phoneNumber || "").toLowerCase();
                        const name = (item.name || "").toLowerCase();
                        return phone.includes(q) || name.includes(q);
                      })
                      .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                          {formatDisplayPhoneNumber(item.phoneNumber)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.name || "Admin / Pembina"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleRemoveExclusion(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldOff className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Terminal Log Stream Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                  Live Engine Terminal Logs
                </h3>
              </div>

              <button
                onClick={clearConsoleLogs}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan</span>
              </button>
            </div>

            <div className="flex-1 bg-slate-950 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-2 text-slate-200 border border-slate-900 shadow-inner">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">
                  Belum ada log aktivitas. Log real-time akan muncul saat bot beroperasi...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 select-none">[{log.time}]</span>
                    <span className="text-emerald-400 font-semibold">$</span>
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Join Group via Invite Link Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-wide">
                    Gabungkan Bot via Link Undangan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Masukkan Link Undangan Grup WhatsApp untuk memasukkan bot tanpa memegang HP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinGroupViaInvite} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Link Undangan Grup WhatsApp (Invite Link)
                </label>
                <input
                  type="text"
                  placeholder="https://chat.whatsapp.com/ABC123xyz..."
                  value={inviteUrl}
                  onChange={(e) => setInviteUrl(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 <b>Petunjuk:</b> Buka info grup WhatsApp di HP Anda ➔ Klik <b>"Undang via Tautan" (Invite via Link)</b> ➔ Tempelkan linknya di atas. Bot akan langsung bergabung otomatis!
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={joiningGroup || !inviteUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {joiningGroup ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Bergabung ke Grup...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Gabungkan Bot Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Exclude Member Name Input Modal */}
      {excludeModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambahkan ke Exclusion List</h3>
                  <p className="text-xs text-slate-500">Kecualikan nomor dari pesan WA bot</p>
                </div>
              </div>
              <button
                onClick={() => setExcludeModalMember(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setExcludingMember(true);
                await handleExcludeMemberDirect(
                  excludeModalMember.phone,
                  excludeModalMember.name.trim() || "Anggota Grup Dikecualikan"
                );
                setExcludingMember(false);
                setExcludeModalMember(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp / ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={formatDisplayPhoneNumber(excludeModalMember.phone)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap / Jabatan Pengecualian
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pak Pembina Velocity, Admin, Rizky"
                  value={excludeModalMember.name}
                  onChange={(e) =>
                    setExcludeModalMember({ ...excludeModalMember, name: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 <b>Petunjuk:</b> Isikan nama atau keterangan jabatan agar mudah dikenali di daftar pengecualian.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setExcludeModalMember(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={excludingMember}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {excludingMember ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Simpan Ke Exclusion List</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
