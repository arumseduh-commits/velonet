"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, AlertTriangle, ShieldCheck, ShieldAlert, Eye, EyeOff, Users, Minimize2, Maximize2 } from "lucide-react";
import { loadFaceApiModels, getFaceApi } from "@/lib/client-face-api";

interface FaceProctorWidgetProps {
  enabled: boolean;
  onViolation: (type: string, description: string) => void;
  onCameraStatusChange?: (ready: boolean) => void;
}

export default function FaceProctorWidget({
  enabled,
  onViolation,
  onCameraStatusChange,
}: FaceProctorWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceCount, setFaceCount] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState("Memulai kamera...");
  const [isMinimized, setIsMinimized] = useState(false);
  const [warningCount, setWarningCount] = useState(0);

  const consecutiveNoFaceRef = useRef(0);
  const consecutiveMultiFaceRef = useRef(0);

  // 1. Initialize models & camera
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const init = async () => {
      try {
        const loaded = await loadFaceApiModels();
        if (!isMounted) return;
        setModelsReady(loaded);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraActive(true);
        onCameraStatusChange?.(true);
        setStatusMessage("Pengawasan AI Aktif");
      } catch (err: any) {
        console.error("[FaceProctor] Camera / Model init error:", err);
        setStatusMessage("Kamera gagal diakses.");
        onCameraStatusChange?.(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled, onCameraStatusChange]);

  // 2. Periodic Face Scan
  useEffect(() => {
    if (!enabled || !modelsReady || !cameraActive) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const api = await getFaceApi();
        if (!api) return;

        const detections = await api.detectAllFaces(
          videoRef.current,
          new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })
        );

        const count = detections.length;
        setFaceCount(count);

        if (count === 0) {
          consecutiveNoFaceRef.current += 1;
          consecutiveMultiFaceRef.current = 0;

          // If no face detected for 2 consecutive checks (~6 seconds)
          if (consecutiveNoFaceRef.current >= 2) {
            setStatusMessage("Wajah tidak terlihat!");
            onViolation("NO_FACE_DETECTED", "Wajah peserta tidak terdeteksi di kamera depan.");
            setWarningCount((p) => p + 1);
            consecutiveNoFaceRef.current = 0;
          } else {
            setStatusMessage("Mencari wajah...");
          }
        } else if (count > 1) {
          consecutiveMultiFaceRef.current += 1;
          consecutiveNoFaceRef.current = 0;

          // If multiple faces detected
          if (consecutiveMultiFaceRef.current >= 1) {
            setStatusMessage(`Terdeteksi ${count} orang!`);
            onViolation("MULTIPLE_FACES", `Terdeteksi ${count} wajah di kamera (indikasi bantuan/joki).`);
            setWarningCount((p) => p + 1);
            consecutiveMultiFaceRef.current = 0;
          }
        } else {
          // Exactly 1 face -> Valid
          consecutiveNoFaceRef.current = 0;
          consecutiveMultiFaceRef.current = 0;
          setStatusMessage("Wajah Terverifikasi (1 Orang)");
        }
      } catch (err) {
        console.warn("[FaceProctor] Scan error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, modelsReady, cameraActive, onViolation]);

  if (!enabled) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 transition-all duration-300 rounded-2xl bg-slate-900/90 backdrop-blur-md border shadow-2xl overflow-hidden ${
        faceCount === 0
          ? "border-amber-500/80 ring-2 ring-amber-500/40"
          : faceCount > 1
          ? "border-rose-500/80 ring-2 ring-rose-500/40"
          : "border-emerald-500/40"
      } ${isMinimized ? "w-44 p-2.5" : "w-52 sm:w-60 p-3"}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-1 mb-2 text-xs font-semibold text-white">
        <div className="flex items-center gap-1.5 truncate">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                faceCount === 1 ? "bg-emerald-400" : faceCount === 0 ? "bg-amber-400" : "bg-rose-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                faceCount === 1 ? "bg-emerald-500" : faceCount === 0 ? "bg-amber-500" : "bg-rose-500"
              }`}
            ></span>
          </span>
          <span className="truncate text-[11px]">AI Proctoring</span>
        </div>

        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isMinimized ? "Perbesar Kamera" : "Perkecil Kamera"}
        >
          {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Video stream */}
      {!isMinimized && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 w-full border border-slate-800">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Overlay Status Badge on Video */}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white">
            <Camera className="w-3 h-3 text-blue-400" />
            <span>LIVE</span>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] text-white">
            <div className="flex items-center gap-1">
              {faceCount === 1 ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : faceCount === 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              ) : (
                <Users className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              )}
              <span className="font-semibold">{faceCount} Wajah</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="mt-2 text-center">
        <p
          className={`text-[11px] font-medium truncate ${
            faceCount === 1
              ? "text-emerald-400"
              : faceCount === 0
              ? "text-amber-300 font-semibold"
              : "text-rose-400 font-semibold"
          }`}
        >
          {statusMessage}
        </p>
      </div>
    </div>
  );
}
