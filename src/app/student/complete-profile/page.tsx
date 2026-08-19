"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, Calendar, Users, GraduationCap, Target, Heart, CheckCircle2, RefreshCw, LogOut, ShieldCheck, Camera, CameraOff, Sparkles, Smile } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { loadFaceApiModels, detectFaceWithDescriptor, captureFrameBase64 } from "@/lib/client-face-api";

// Daftar Kelas SMKN 1: 5 Jurusan (RPL 2, BD 4, AK 3, LP 2, MP 4) x 3 Angkatan (X, XI, XII)
const SCHOOL_CLASSES = {
  "Tingkat X (Kelas 10)": [
    "X RPL 1", "X RPL 2",
    "X BD 1", "X BD 2", "X BD 3", "X BD 4",
    "X AK 1", "X AK 2", "X AK 3",
    "X LP 1", "X LP 2",
    "X MP 1", "X MP 2", "X MP 3", "X MP 4",
  ],
  "Tingkat XI (Kelas 11)": [
    "XI RPL 1", "XI RPL 2",
    "XI BD 1", "XI BD 2", "XI BD 3", "XI BD 4",
    "XI AK 1", "XI AK 2", "XI AK 3",
    "XI LP 1", "XI LP 2",
    "XI MP 1", "XI MP 2", "XI MP 3", "XI MP 4",
  ],
  "Tingkat XII (Kelas 12)": [
    "XII RPL 1", "XII RPL 2",
    "XII BD 1", "XII BD 2", "XII BD 3", "XII BD 4",
    "XII AK 1", "XII AK 2", "XII AK 3",
    "XII LP 1", "XII LP 2",
    "XII MP 1", "XII MP 2", "XII MP 3", "XII MP 4",
  ],
};

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const MONTHS = [
  { value: "01", label: "01 - Jan" },
  { value: "02", label: "02 - Feb" },
  { value: "03", label: "03 - Mar" },
  { value: "04", label: "04 - Apr" },
  { value: "05", label: "05 - Mei" },
  { value: "06", label: "06 - Jun" },
  { value: "07", label: "07 - Jul" },
  { value: "08", label: "08 - Agu" },
  { value: "09", label: "09 - Sep" },
  { value: "10", label: "10 - Okt" },
  { value: "11", label: "11 - Nov" },
  { value: "12", label: "12 - Des" },
];

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useDialog();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialPhone, setInitialPhone] = useState("");
  
  // State Tanggal Lahir (Pemisahan Tanggal, Bulan, Tahun agar 100% rapi di semua HP)
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    studentClass: "",
    motivation: "",
    hobby: "",
  });

  // Face Enrollment State for Onboarding
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturingFace, setCapturingFace] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    try {
      await loadFaceApiModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (e: any) {
      toast.error(`Kamera tidak dapat dibuka: ${e.message || "Periksa izin browser."}`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleCaptureFace = async () => {
    if (!videoRef.current || !cameraActive) return;
    setCapturingFace(true);
    toast.info("Menganalisis wajah Anda...");

    try {
      const detection = await detectFaceWithDescriptor(videoRef.current);
      if (!detection) {
        toast.warning("Wajah tidak terdeteksi! Pastikan wajah Anda berada di tengah kamera.");
        setCapturingFace(false);
        return;
      }

      const photoBase64 = captureFrameBase64(videoRef.current, detection.box);
      setFaceDescriptor(detection.descriptor);
      setFacePhoto(photoBase64);
      stopCamera();
      toast.success("Foto & vektor biometrik wajah berhasil diambil!");
    } catch (e: any) {
      toast.error("Gagal mendeteksi wajah.");
    } finally {
      setCapturingFace(false);
    }
  };

  // Batas tahun maksimal (Minimal 15 Tahun dari tahun sekarang)
  const maxAllowedYear = useMemo(() => {
    return new Date().getFullYear() - 15;
  }, []);

  const YEARS = useMemo(() => {
    return Array.from({ length: maxAllowedYear - 1990 + 1 }, (_, i) => String(maxAllowedYear - i));
  }, [maxAllowedYear]);

  // Cek apakah nomor yang tersimpan adalah LID Baileys
  const isLidNumber = useMemo(() => {
    if (!initialPhone) return false;
    const clean = initialPhone.replace(/\D/g, "");
    return clean.length > 13 || (!clean.startsWith("62") && !clean.startsWith("08"));
  }, [initialPhone]);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/student/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            if (json.data.status === "COMPLETED" && json.data.name) {
              router.replace("/student");
              return;
            }
            if (isMounted) {
              const rawPhone = json.data.phoneNumber || "";
              setInitialPhone(rawPhone);

              // Prefill tanggal lahir jika ada
              if (json.data.birthDate) {
                const parts = json.data.birthDate.split("-");
                if (parts.length === 3) {
                  setBirthYear(parts[0]);
                  setBirthMonth(parts[1]);
                  setBirthDay(parts[2]);
                }
              }

              setFormData((prev) => ({
                name: prev.name || (json.data.name || "").toUpperCase(),
                gender: prev.gender || json.data.gender || "",
                studentClass: prev.studentClass || json.data.studentClass || "",
                motivation: prev.motivation || json.data.motivation || "",
                hobby: prev.hobby || json.data.hobby || "",
              }));
            }
          } else {
            router.replace("/student/login");
          }
        } else {
          router.replace("/student/login");
        }
      } catch (e) {
        console.error("Failed to check profile status:", e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/student/auth/logout", { method: "POST" });
      router.replace("/student/login");
    } catch (e) {
      router.replace("/student/login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validasi Nama Minimal 4 Huruf
    if (!formData.name || formData.name.trim().length < 4) {
      toast.error("Nama Lengkap wajib diisi minimal 4 huruf / karakter.");
      return;
    }

    // 2. Validasi Tanggal Lahir (Minimal 15 Tahun)
    if (!birthDay || !birthMonth || !birthYear) {
      toast.error("Silakan lengkapi Tanggal, Bulan, dan Tahun Lahir.");
      return;
    }
    const combinedBirthDate = `${birthYear}-${birthMonth}-${birthDay}`;
    const birth = new Date(combinedBirthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 15) {
      toast.error("Usia minimal pendaftaran adalah 15 tahun.");
      return;
    }

    // 3. Validasi Jenis Kelamin
    if (!formData.gender) {
      toast.error("Silakan pilih jenis kelamin.");
      return;
    }

    // 4. Validasi Kelas
    if (!formData.studentClass) {
      toast.error("Silakan pilih kelas asal Anda.");
      return;
    }

    // 5. Validasi Motivasi & Hobi
    if (!formData.motivation.trim()) {
      toast.error("Alasan / Motivasi wajib diisi.");
      return;
    }
    if (!formData.hobby.trim()) {
      toast.error("Hobi & minat wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/student/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name: formData.name.trim().toUpperCase(),
          birthDate: combinedBirthDate,
          faceDescriptor: faceDescriptor || undefined,
          facePhoto: facePhoto || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pendaftaran berhasil disimpan! Selamat bergabung di VeloNet. 🎉");
        router.push("/student");
      } else {
        toast.error(json.error || "Gagal menyimpan pendaftaran.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan koneksi ke server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Memuat formulir pendaftaran...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-xl bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 shrink-0">
              V
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                Pendaftaran Anggota
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide mt-1">
                Lengkapi Data Diri
              </h1>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700/50 transition-colors"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner WhatsApp */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex items-start gap-3 text-xs">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">WhatsApp Terverifikasi</span>
              {!isLidNumber && initialPhone && (
                <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px]">
                  +{initialPhone}
                </span>
              )}
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Akun WhatsApp Anda telah tervalidasi di sistem VeloNet. Silakan lengkapi biodata di bawah ini untuk menyelesaikan pendaftaran.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Nama Lengkap (Otomatis Kapital, Min 4 Karakter) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                <span>Nama Lengkap <span className="text-rose-400">*</span></span>
              </span>
              <span className="text-[11px] text-slate-500">Min. 4 huruf (KAPITAL)</span>
            </label>
            <input
              type="text"
              required
              minLength={4}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              placeholder="CONTOH: AHMAD FAUZI SYAHPUTRA"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-semibold tracking-wide uppercase transition-colors"
            />
          </div>

          {/* 2. Tanggal Lahir (3 Dropdown: Tgl, Bulan, Tahun - 100% Rapi & Tidak Keluar Outline) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Tanggal Lahir <span className="text-rose-400">*</span></span>
              </span>
              <span className="text-[11px] text-slate-500">Min. 15 thn (Maks. {maxAllowedYear})</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {/* Tanggal */}
              <div className="relative">
                <select
                  required
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-slate-950 text-slate-500">
                    Tgl
                  </option>
                  {DAYS.map((d) => (
                    <option key={d} value={d} className="bg-slate-950 text-slate-200">
                      {d}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Bulan */}
              <div className="relative">
                <select
                  required
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full px-2.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-slate-950 text-slate-500">
                    Bulan
                  </option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-slate-950 text-slate-200">
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Tahun */}
              <div className="relative">
                <select
                  required
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-slate-950 text-slate-500">
                    Tahun
                  </option>
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="bg-slate-950 text-slate-200">
                      {y}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Jenis Kelamin */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Jenis Kelamin <span className="text-rose-400">*</span></span>
            </label>
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: "Laki-laki" })}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formData.gender === "Laki-laki"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
                style={{ minHeight: "44px" }}
              >
                <span>👨 Laki-laki</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: "Perempuan" })}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formData.gender === "Perempuan"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
                style={{ minHeight: "44px" }}
              >
                <span>👩 Perempuan</span>
              </button>
            </div>
          </div>

          {/* 4. Kelas (Dropdown Pilihan SMKN 1: 5 Jurusan x 3 Angkatan) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>Kelas Asal SMKN 1 <span className="text-rose-400">*</span></span>
              </span>
              <span className="text-[11px] text-slate-500">Pilih dari 45 kelas</span>
            </label>
            <div className="relative">
              <select
                required
                value={formData.studentClass}
                onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none text-xs"
                style={{ minHeight: "44px" }}
              >
                <option value="" disabled className="bg-slate-950 text-slate-500">
                  -- Pilih Kelas & Jurusan Asal --
                </option>
                {Object.entries(SCHOOL_CLASSES).map(([gradeGroup, classes]) => (
                  <optgroup key={gradeGroup} label={gradeGroup} className="bg-slate-900 text-emerald-400 font-bold">
                    {classes.map((cls) => (
                      <option key={cls} value={cls} className="bg-slate-950 text-slate-200 font-normal py-1">
                        {cls}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 5. Alasan / Motivasi Join */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Alasan / Motivasi Masuk Ekskul <span className="text-rose-400">*</span></span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.motivation}
              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              placeholder="Ceritakan singkat mengapa Anda ingin bergabung dengan Komunitas Velocity..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium resize-none transition-colors"
            />
          </div>

          {/* 6. Hobi */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span>Hobi & Minat <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.hobby}
              onChange={(e) => setFormData({ ...formData, hobby: e.target.value })}
              placeholder="Contoh: Coding, Desain Grafis, Membaca, Musik, Badminton..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium transition-colors"
            />
          </div>

          {/* 7. Perekaman Wajah (Face Enrollment) */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Sampel Wajah untuk Absensi AI</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                {faceDescriptor ? "Wajah Terekam ✅" : "Disarankan"}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ambil sampel foto wajah untuk kemudahan absensi kehadiran berbasis AI saat kegiatan ekskul.
            </p>

            {/* Video preview / Photo snapshot */}
            {cameraActive ? (
              <div className="space-y-2">
                <div className="relative aspect-video max-h-[220px] rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureFace}
                    disabled={capturingFace}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {capturingFace ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ambil & Analisis Wajah</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : facePhoto ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <img
                  src={facePhoto}
                  alt="Face Sample"
                  className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Wajah Siap Digunakan</span>
                  </p>
                  <p className="text-[10px] text-slate-400">Vektor biometrik 128-d telah terekstrak.</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Ambil Ulang Foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Nyalakan Kamera untuk Rekam Wajah</span>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Pendaftaran...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>SELESAIKAN PENDAFTARAN</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
