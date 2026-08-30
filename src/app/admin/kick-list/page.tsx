"use client";

import { useEffect, useState } from "react";
import { UserX, CheckSquare, Square, Copy, Check, RefreshCw, AlertCircle, UserMinus, ShieldAlert, Search } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import Pagination from "@/components/ui/Pagination";

interface KickParticipant {
  id: string;
  phoneNumber: string;
  name: string | null;
  studentClass: string | null;
  status: string;
  isKickedFromGrp: boolean;
  updatedAt: string;
}

interface SavedGroup {
  id: string;
  subject: string;
  size: number;
}

export default function KickListPage() {
  const { confirm, toast } = useDialog();
  const [list, setList] = useState<KickParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [customJid, setCustomJid] = useState<string>("");
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "ALL">(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchKickList = async (isSilent = false, overridePage?: number, overridePageSize?: number | "ALL") => {
    if (!isSilent) setLoading(true);
    try {
      const activePage = overridePage !== undefined ? overridePage : page;
      const activeSize = overridePageSize !== undefined ? overridePageSize : pageSize;

      const url = new URL("/api/kick-list", window.location.origin);
      if (searchQuery) url.searchParams.set("query", searchQuery);
      url.searchParams.set("page", activePage.toString());
      url.searchParams.set("limit", activeSize.toString());

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setList(json.data);
        if (json.pagination) {
          setTotalItems(json.pagination.total);
          setTotalPages(json.pagination.totalPages);
        } else {
          setTotalItems(json.data.length);
          setTotalPages(1);
        }
      }
    } catch (err) {
      console.error("Failed to fetch kick list:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/bot/groups");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setGroups(json.data);
        if (json.data.length > 0 && !targetGroupId) {
          setTargetGroupId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchKickList(false, 1);
    fetchGroups();
  }, [pageSize]);

  const toggleKickStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/kick-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isKickedFromGrp: !currentStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Status kick berhasil diperbarui.");
        setList((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isKickedFromGrp: !currentStatus } : item
          )
        );
      }
    } catch (err) {
      console.error("Failed to update kick status:", err);
    }
  };

  const handleAutoKickViaBot = async (participant: KickParticipant) => {
    const effectiveGroupId = targetGroupId === "custom" ? customJid.trim() : targetGroupId.trim();
    if (!effectiveGroupId) {
      toast.warning("Pilih atau masukkan Target Group terlebih dahulu untuk melakukan kick via bot.");
      return;
    }

    const confirmed = await confirm({
      title: "Keluarkan (Kick) Peserta",
      message: `Keluarkan (kick) +${participant.phoneNumber} (${participant.name || "Peserta"}) dari grup WhatsApp secara otomatis?`,
      confirmText: "Ya, Kick Peserta",
      cancelText: "Batal",
      variant: "danger",
      icon: "warning",
    });

    if (!confirmed) return;

    setKickingId(participant.id);
    try {
      const res = await fetch("/api/kick-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          groupId: effectiveGroupId,
          phoneNumber: participant.phoneNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Peserta berhasil dikeluarkan dari grup.");
        setList((prev) =>
          prev.map((item) =>
            item.id === participant.id ? { ...item, isKickedFromGrp: true } : item
          )
        );
      } else {
        toast.error(json.error || json.message || "Gagal mengeluarkan peserta.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setKickingId(null);
    }
  };

  const handleResendConfirmation = async (participant: KickParticipant) => {
    const confirmed = await confirm({
      title: "Kirim Ulang Konfirmasi DM",
      message: `Kirim ulang pesan konfirmasi DM ke +${participant.phoneNumber} (${participant.name || "Peserta"}) dan reset statusnya agar dapat mendaftar kembali?`,
      confirmText: "Ya, Kirim Ulang",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!confirmed) return;

    setResendingId(participant.id);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_member_confirmation",
          phoneNumber: participant.phoneNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Pesan konfirmasi berhasil dikirim ulang ke +${participant.phoneNumber}`);
        fetchKickList();
      } else {
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyNumbers = () => {
    const unkickedNumbers = list
      .filter((i) => !i.isKickedFromGrp)
      .map((i) => `+${i.phoneNumber}`)
      .join("\n");

    if (!unkickedNumbers) return;

    navigator.clipboard.writeText(unkickedNumbers);
    setCopied(true);
    toast.success("Daftar nomor HP berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-slate-900 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Kick List (Konfirmasi TIDAK) <UserX className="w-5 h-5 text-rose-500" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar anggota yang mengonfirmasi TIDAK ingin melanjutkan ekskul Velocity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyNumbers}
            disabled={list.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Nomor Berhasil Disalin!" : "Salin Nomor Belum Di-kick"}</span>
          </button>

          <button
            onClick={() => fetchKickList()}
            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 shadow-xs cursor-pointer"
            title="Refresh Kick List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Target Group Selector Banner */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span><b>Pilih Grup Target untuk Kick Otomatis:</b> (Pastikan Bot adalah Admin di grup ini)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {groups.length > 0 ? (
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  👥 {g.subject} ({g.size || 0} Anggota)
                </option>
              ))}
              <option value="custom">✍️ Ketik ID Grup Custom (JID)...</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder="120363041234567890@g.us"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full sm:w-72 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
            />
          )}

          {targetGroupId === "custom" && (
            <input
              type="text"
              placeholder="Ketik ID Grup JID..."
              value={customJid}
              onChange={(e) => setCustomJid(e.target.value)}
              className="w-full sm:w-64 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
            />
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Semua anggota yang ada di daftar ini secara otomatis dihentikan dari pengiriman pengingat bot. Anda dapat meng-kick anggota secara otomatis dengan mengeklik tombol <b>"Kick via Bot"</b> (jika bot adalah Admin grup) atau menandai checklist secara manual.
        </p>
      </div>

      {/* Real-time Search Bar for Phone Number or Name */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Cari berdasarkan nomor WhatsApp (misal: 62812...) atau Nama..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-lg bg-slate-100 cursor-pointer"
          >
            Bersihkan
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">Status Kick</th>
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4">Waktu Konfirmasi</th>
                <th className="py-3.5 px-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                    Memuat daftar kick list...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada anggota yang memilih TIDAK.
                  </td>
                </tr>
              ) : list.filter((item) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  const phone = (item.phoneNumber || "").toLowerCase();
                  const name = (item.name || "").toLowerCase();
                  return phone.includes(q) || name.includes(q);
                }).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ditemukan nomor HP/nama yang cocok dengan "{searchQuery}".
                  </td>
                </tr>
              ) : (
                list
                  .filter((item) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase().trim();
                    const phone = (item.phoneNumber || "").toLowerCase();
                    const name = (item.name || "").toLowerCase();
                    return phone.includes(q) || name.includes(q);
                  })
                  .map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.isKickedFromGrp ? "bg-slate-50/60 opacity-60" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => toggleKickStatus(item.id, item.isKickedFromGrp)}
                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {item.isKickedFromGrp ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600">
                      +{item.phoneNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.name || <span className="text-slate-400 font-normal">-</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.studentClass || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(item.updatedAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleResendConfirmation(item)}
                        disabled={resendingId === item.id}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {resendingId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Resend Konfirmasi</span>
                      </button>

                      {!item.isKickedFromGrp && (
                        <button
                          onClick={() => handleAutoKickViaBot(item)}
                          disabled={kickingId === item.id || !targetGroupId}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {kickingId === item.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="w-3.5 h-3.5" />
                          )}
                          <span>Kick via Bot</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleKickStatus(item.id, item.isKickedFromGrp)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.isKickedFromGrp
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        {item.isKickedFromGrp ? "Sudah Di-kick" : "Tandai Manual"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setPage(newPage);
              fetchKickList(false, newPage, pageSize);
            }}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
              fetchKickList(false, 1, newSize);
            }}
            itemLabel="peserta"
            isLoading={loading}
          />
        </div>
      </div>
    </div>
  );
}
