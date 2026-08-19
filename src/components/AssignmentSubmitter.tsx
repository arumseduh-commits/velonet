"use client";

import React, { useState } from "react";
import { useDialog } from "@/components/ui/DialogProvider";

interface AssignmentSubmitterProps {
  assignmentId: string;
  userId: string;
  onSuccess?: () => void;
}

export default function AssignmentSubmitter({
  assignmentId,
  userId,
  onSuccess,
}: AssignmentSubmitterProps) {
  const { confirm, toast } = useDialog();
  const [contentUrl, setContentUrl] = useState("");
  const [textResponse, setTextResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contentUrl.trim() && !textResponse.trim()) {
      toast.warning("Mohon isi URL/Link file atau jawaban teks.");
      return;
    }

    const isConfirmed = await confirm({
      title: "Kirim Tugas",
      message: "Apakah kamu yakin ingin mengirimkan tugas ini? Jawaban tidak dapat diubah setelah dikirim.",
      confirmText: "Ya, Kirim",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId,
          userId,
          contentUrl,
          textResponse,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengirim tugas");
      }

      toast.success("Tugas berhasil dikirim!");
      setContentUrl("");
      setTextResponse("");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan sistem saat mengirim tugas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl w-full max-w-lg mx-auto">
      <h3 className="text-lg font-bold text-white mb-4">Kumpul Tugas</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contentUrl" className="block text-sm font-medium text-slate-300 mb-1.5">
            URL / Link File (Opsional)
          </label>
          <input
            id="contentUrl"
            type="url"
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Masukkan link repositori atau Google Drive</p>
        </div>

        <div>
          <label htmlFor="textResponse" className="block text-sm font-medium text-slate-300 mb-1.5">
            Jawaban Teks (Opsional)
          </label>
          <textarea
            id="textResponse"
            value={textResponse}
            onChange={(e) => setTextResponse(e.target.value)}
            rows={4}
            placeholder="Tuliskan jawaban atau penjelasanmu di sini..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-y text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center px-4 py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isSubmitting ? "Mengirim..." : "Kirim Tugas"}
        </button>
      </form>
    </div>
  );
}
