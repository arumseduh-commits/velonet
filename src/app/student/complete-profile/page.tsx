"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Calendar,
  Users,
  GraduationCap,
  Target,
  Heart,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Camera,
  Smile,
  Sparkles,
  Eye,
  Zap,
  ArrowRight,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  loadFaceApiModels,
  detectFaceLivenessAndDescriptor,
  captureFrameBase64,
} from "@/lib/client-face-api";

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

type RegistrationStep = "FORM" | "KYC_SCAN";
type LivenessStage = "CENTER" | "BLINK" | "SMILE" | "FLASH" | "CAPTURING" | "DONE";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useDialog();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialPhone, setInitialPhone] = useState("");
  const [step, setStep] = useState<RegistrationStep>("FORM");

  // State Tanggal Lahir (Pemisahan Tanggal, Bulan, Tahun)
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

  // KYC Liveness Camera & Verification State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [livenessStage, setLivenessStage] = useState<LivenessStage>("CENTER");
  const [guideText, setGuideText] = useState("Posisikan wajah Anda tepat di dalam lingkaran");
  const [blinkProgress, setBlinkProgress] = useState(false);
  const [smileProgress, setSmileProgress] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null); // 'red' | 'yellow' | 'green' | 'blue' | null
  const [faceDescriptorCaptured, setFaceDescriptorCaptured] = useState<number[] | null>(null);
  const [photoBase64Captured, setPhotoBase64Captured] = useState<string | null>(null);

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
            if (
              (json.data.status === "COMPLETED" ||
                Boolean(json.data.name && json.data.studentClass)) &&
              json.data.name &&
              json.data.name !== "Siswa Baru"
            ) {
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

  // Start Camera for Full-Screen KYC Liveness
  const startKYCCamera = useCallback(async () => {
    setCameraLoading(true);
    try {
      await loadFaceApiModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setLivenessStage("CENTER");
        setGuideText("Posisikan wajah Anda tepat di dalam lingkaran");
      }
    } catch (err: any) {
      console.error("[KYC Camera Error]", err);
      toast.error(`Kamera tidak dapat diakses: ${err.message || "Periksa izin kamera browser."}`);
    } finally {
      setCameraLoading(false);
    }
  }, [toast]);

  const stopKYCCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Submit Step 1: Form Validation & Move to KYC Screen
  const handleProceedToKYC = async (e: React.FormEvent) => {
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

    // Simpan data profil awal ke backend
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name: formData.name.trim().toUpperCase(),
          birthDate: combinedBirthDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStep("KYC_SCAN");
        startKYCCamera();
      } else {
        toast.error(json.error || "Gagal menyimpan data biodata.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan koneksi saat menyimpan biodata.");
    } finally {
      setSubmitting(false);
    }
  };

  // Run Flash Sequence (Merah -> Kuning -> Hijau -> Biru)
  const triggerScreenFlashSequence = useCallback(async (
    descriptor: number[],
    photo: string
  ) => {
    setLivenessStage("FLASH");
    setGuideText("Tatap layar saat verifikasi warna cahaya...");

    // Color sequence
    setFlashColor("red");
    await new Promise((r) => setTimeout(r, 450));
    setFlashColor("yellow");
    await new Promise((r) => setTimeout(r, 450));
    setFlashColor("green");
    await new Promise((r) => setTimeout(r, 450));
    setFlashColor("blue");
    await new Promise((r) => setTimeout(r, 450));
    setFlashColor(null);

    // Save biometrics to server
    setLivenessStage("CAPTURING");
    setGuideText("Menyimpan & memverifikasi biometrik...");

    try {
      const res = await fetch("/api/student/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: descriptor,
          photoBase64: photo,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLivenessStage("DONE");
        setGuideText("Verifikasi Biometrik Berhasil!");
        stopKYCCamera();
        toast.success("Pendaftaran & Verifikasi Wajah Berhasil! Selamat datang di VeloNet.");
        setTimeout(() => {
          router.replace("/student");
        }, 1500);
      } else {
        toast.error(json.error || "Gagal menyimpan data wajah.");
        setLivenessStage("CENTER");
        setBlinkProgress(false);
        setSmileProgress(false);
        setGuideText("Posisikan wajah Anda kembali di dalam lingkaran");
      }
    } catch (e) {
      toast.error("Gagal mengirim data wajah ke server.");
      setLivenessStage("CENTER");
      setBlinkProgress(false);
      setSmileProgress(false);
      setGuideText("Posisikan wajah Anda kembali di dalam lingkaran");
    }
  }, [router, stopKYCCamera, toast]);

  // Liveness Detection Loop
  useEffect(() => {
    if (step !== "KYC_SCAN" || !cameraActive || !videoRef.current) return;

    let isSubmitting = false;
    let blinkDetected = false;
    let smileDetected = false;
    let faceCenteredCount = 0;

    const processFrame = async () => {
      if (!videoRef.current || !cameraActive || isSubmitting) return;

      try {
        const liveness = await detectFaceLivenessAndDescriptor(videoRef.current);

        if (liveness.detected && liveness.box) {
          faceCenteredCount++;

          // 1. Stage: Center
          if (!blinkDetected && livenessStage === "CENTER" && faceCenteredCount > 5) {
            setLivenessStage("BLINK");
            setGuideText("Silakan KEDIPKAN MATA Anda secara natural");
          }

          // 2. Stage: Blink Detection (EAR < 0.225)
          if (livenessStage === "BLINK" && liveness.isBlinking && !blinkDetected) {
            blinkDetected = true;
            setBlinkProgress(true);
            setLivenessStage("SMILE");
            setGuideText("Bagus! Sekarang silakan TERSENYUM ke kamera");
          }

          // 3. Stage: Smile Detection (Smile Score > 0.60)
          if (livenessStage === "SMILE" && (liveness.isSmiling || (liveness.smileScore && liveness.smileScore > 0.55)) && !smileDetected) {
            smileDetected = true;
            setSmileProgress(true);

            // Extract reference snapshot and descriptor
            if (liveness.descriptor && videoRef.current) {
              isSubmitting = true;
              const photo = captureFrameBase64(videoRef.current, liveness.box);
              if (photo) {
                setFaceDescriptorCaptured(liveness.descriptor);
                setPhotoBase64Captured(photo);
                await triggerScreenFlashSequence(liveness.descriptor, photo);
              }
            }
          }
        }
      } catch (err) {
        // continue loop
      }

      if (cameraActive && !isSubmitting) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [step, cameraActive, livenessStage, triggerScreenFlashSequence]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-emerald-600 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Memuat formulir pendaftaran...</p>
      </div>
    );
  }

  // --- FULL SCREEN KYC LIVENESS SCANNER VIEW ---
  if (step === "KYC_SCAN") {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-hidden">
        {/* Full-Screen Colored Light Flash Overlay (Anti-Spoofing Screen Reflection) */}
        {flashColor && (
          <div
            className={`fixed inset-0 z-50 pointer-events-none transition-colors duration-200 animate-pulse ${
              flashColor === "red"
                ? "bg-rose-600/90"
                : flashColor === "yellow"
                ? "bg-amber-400/90"
                : flashColor === "green"
                ? "bg-emerald-500/90"
                : "bg-blue-600/90"
            }`}
          />
        )}

        {/* Top Header */}
        <div className="w-full max-w-md flex items-center justify-between pt-2 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20">
              V
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5 drop-shadow-md">
                <span>Verifikasi Biometrik Wajah</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h2>
              <p className="text-[11px] text-slate-300 drop-shadow-sm">KYC Liveness Detection VeloNet</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopKYCCamera();
              setStep("FORM");
            }}
            type="button"
            className="text-xs text-white hover:text-slate-200 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md transition-colors cursor-pointer"
          >
            Kembali ke Form
          </button>
        </div>

        {/* Circular / Oval Biometric Camera Frame */}
        <div className="relative flex flex-col items-center justify-center my-auto z-20">
          {/* Oval Glowing Guide Border */}
          <div
            className={`relative w-64 h-80 sm:w-72 sm:h-96 rounded-[120px] overflow-hidden border-4 shadow-2xl transition-all duration-500 ${
              livenessStage === "DONE"
                ? "border-emerald-400 shadow-emerald-500/40"
                : livenessStage === "FLASH"
                ? "border-amber-400 shadow-amber-500/50"
                : livenessStage === "SMILE"
                ? "border-teal-400 shadow-teal-500/30 animate-pulse"
                : livenessStage === "BLINK"
                ? "border-blue-400 shadow-blue-500/30 animate-pulse"
                : "border-emerald-500/80 shadow-emerald-500/20"
            }`}
          >
            {/* Live Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Circular Guide Overlay Lines */}
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/30 rounded-[116px]" />

            {cameraLoading && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-300">Menyiapkan kamera biometrik...</span>
              </div>
            )}
          </div>

          {/* Real-time Instructions Badge */}
          <div className="mt-6 text-center space-y-2 max-w-sm px-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 border border-slate-200 shadow-2xl backdrop-blur-md text-slate-900">
              {livenessStage === "BLINK" ? (
                <Eye className="w-4 h-4 text-blue-600 animate-bounce" />
              ) : livenessStage === "SMILE" ? (
                <Smile className="w-4 h-4 text-amber-500 animate-bounce" />
              ) : livenessStage === "FLASH" ? (
                <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
              ) : livenessStage === "DONE" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Camera className="w-4 h-4 text-emerald-600" />
              )}
              <span className="text-xs font-bold text-slate-900">{guideText}</span>
            </div>

            {/* Progress Badges */}
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition-all ${
                  blinkProgress
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-xs"
                    : "bg-white/80 text-slate-700 border-slate-200 backdrop-blur-md"
                }`}
              >
                {blinkProgress ? "✓" : "1."} Kedip Mata
              </span>

              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition-all ${
                  smileProgress
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-xs"
                    : "bg-white/80 text-slate-700 border-slate-200 backdrop-blur-md"
                }`}
              >
                {smileProgress ? "✓" : "2."} Senyum
              </span>

              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition-all ${
                  livenessStage === "DONE"
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-xs"
                    : "bg-white/80 text-slate-700 border-slate-200 backdrop-blur-md"
                }`}
              >
                {livenessStage === "DONE" ? "✓" : "3."} Refleksi Cahaya
              </span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md pb-2 text-center z-20">
          <p className="text-[11px] text-slate-300 drop-shadow-sm flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Data biometrik Anda dienkripsi dan hanya digunakan untuk absensi kehadiran resmi.</span>
          </p>
        </div>
      </div>
    );
  }

  // --- STEP 1: FORMULIR BIODATA PENDAFTARAN ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/20 shrink-0">
              V
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                Pendaftaran Anggota
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-wide mt-1">
                Lengkapi Data Diri
              </h1>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner WhatsApp */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">WhatsApp Terverifikasi</span>
              {!isLidNumber && initialPhone && (
                <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                  +{initialPhone}
                </span>
              )}
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Akun WhatsApp Anda telah tervalidasi di sistem VeloNet. Silakan lengkapi biodata di bawah ini untuk lanjut ke verifikasi biometrik wajah.
            </p>
          </div>
        </div>

        <form onSubmit={handleProceedToKYC} className="space-y-4 text-xs">
          {/* 1. Nama Lengkap (Otomatis Kapital, Min 4 Karakter) */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                <span>Nama Lengkap <span className="text-rose-500">*</span></span>
              </span>
              <span className="text-[11px] text-slate-400">Min. 4 huruf (KAPITAL)</span>
            </label>
            <input
              type="text"
              required
              minLength={4}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              placeholder="CONTOH: AHMAD FAUZI SYAHPUTRA"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold tracking-wide uppercase transition-colors"
            />
          </div>

          {/* 2. Tanggal Lahir (3 Dropdown: Tgl, Bulan, Tahun) */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Tanggal Lahir <span className="text-rose-500">*</span></span>
              </span>
              <span className="text-[11px] text-slate-400">Min. 15 thn (Maks. {maxAllowedYear})</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {/* Tanggal */}
              <div className="relative">
                <select
                  required
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-white text-slate-400">
                    Tgl
                  </option>
                  {DAYS.map((d) => (
                    <option key={d} value={d} className="bg-white text-slate-800">
                      {d}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
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
                  className="w-full px-2.5 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-white text-slate-400">
                    Bulan
                  </option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-white text-slate-800">
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
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
                  className="w-full px-3 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-colors cursor-pointer appearance-none text-xs text-center"
                  style={{ minHeight: "44px" }}
                >
                  <option value="" disabled className="bg-white text-slate-400">
                    Tahun
                  </option>
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="bg-white text-slate-800">
                      {y}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Jenis Kelamin */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Jenis Kelamin <span className="text-rose-500">*</span></span>
            </label>
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: "Laki-laki" })}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 btn-press transition-all cursor-pointer ${
                  formData.gender === "Laki-laki"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs font-bold"
                    : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
                style={{ minHeight: "44px" }}
              >
                <span>Laki-laki</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: "Perempuan" })}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 btn-press transition-all cursor-pointer ${
                  formData.gender === "Perempuan"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs font-bold"
                    : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
                style={{ minHeight: "44px" }}
              >
                <span>Perempuan</span>
              </button>
            </div>
          </div>

          {/* 4. Kelas (Dropdown Pilihan SMKN 1: 5 Jurusan x 3 Angkatan) */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Kelas Asal SMKN 1 <span className="text-rose-500">*</span></span>
              </span>
              <span className="text-[11px] text-slate-400">Pilih dari 45 kelas</span>
            </label>
            <div className="relative">
              <select
                required
                value={formData.studentClass}
                onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-colors cursor-pointer appearance-none text-xs"
                style={{ minHeight: "44px" }}
              >
                <option value="" disabled className="bg-white text-slate-400">
                  -- Pilih Kelas & Jurusan Asal --
                </option>
                {Object.entries(SCHOOL_CLASSES).map(([gradeGroup, classes]) => (
                  <optgroup key={gradeGroup} label={gradeGroup} className="bg-slate-100 text-slate-900 font-bold">
                    {classes.map((cls) => (
                      <option key={cls} value={cls} className="bg-white text-slate-800 font-normal py-1">
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
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" />
              <span>Alasan / Motivasi Masuk Ekskul <span className="text-rose-500">*</span></span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.motivation}
              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              placeholder="Ceritakan singkat mengapa Anda ingin bergabung dengan Komunitas Velocity..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium resize-none transition-colors"
            />
          </div>

          {/* 6. Hobi */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>Hobi & Minat <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.hobby}
              onChange={(e) => setFormData({ ...formData, hobby: e.target.value })}
              placeholder="Contoh: Coding, Desain Grafis, Membaca, Musik, Badminton..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-colors"
            />
          </div>

          {/* Submit & Go to KYC Liveness Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Biodata...</span>
              </>
            ) : (
              <>
                <span>LANJUT KE VERIFIKASI WAJAH (KYC)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
