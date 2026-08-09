"use client";

import { useEffect, useState } from "react";
import { UserX, CheckSquare, Square, Copy, Check, RefreshCw, AlertCircle, UserMinus, ShieldAlert } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

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

  const fetchKickList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kick-list");
      const json = await res.json();
      if (json.success) {
        setList(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch kick list:", err);
    } finally {
      setLoading(false);
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
    fetchKickList();
    fetchGroups();
  }, []);

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

  const [resendingId, setResendingId] = useState<string | null>(null);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Kick List (Konfirmasi TIDAK) <UserX className="w-5 h-5 text-rose-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Daftar anggota yang mengonfirmasi TIDAK ingin melanjutkan ekskul Velocity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyNumbers}
            disabled={list.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Nomor Berhasil Disalin!" : "Salin Nomor Belum Di-kick"}</span>
          </button>

          <button
            onClick={fetchKickList}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
            title="Refresh Kick List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Target Group Selector Banner */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span><b>Pilih Grup Target untuk Kick Otomatis:</b> (Pastikan Bot adalah Admin di grup ini)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {groups.length > 0 ? (
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full sm:w-80 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
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
              className="w-full sm:w-72 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          )}

          {targetGroupId === "custom" && (
            <input
              type="text"
              placeholder="Ketik ID Grup JID..."
              value={customJid}
              onChange={(e) => setCustomJid(e.target.value)}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Semua anggota yang ada di daftar ini secara otomatis dihentikan dari pengiriman pengingat bot. Anda dapat meng-kick anggota secara otomatis dengan mengeklik tombol <b>"Kick via Bot"</b> (jika bot adalah Admin grup) atau menandai checklist secara manual.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">Status Kick</th>
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4">Waktu Konfirmasi</th>
                <th className="py-3.5 px-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-400" />
                    Memuat daftar kick list...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada anggota yang memilih TIDAK.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.isKickedFromGrp ? "bg-slate-950/40 opacity-60" : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => toggleKickStatus(item.id, item.isKickedFromGrp)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {item.isKickedFromGrp ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-rose-300">
                      +{item.phoneNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {item.name || <span className="text-slate-500 font-normal">-</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.studentClass || <span className="text-slate-500">-</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(item.updatedAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleResendConfirmation(item)}
                        disabled={resendingId === item.id}
                        className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
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
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          item.isKickedFromGrp
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
      </div>
    </div>
  );
}
