"use client";

let faceapi: any = null;
let modelsLoaded = false;
let loadingPromise: Promise<boolean> | null = null;

export async function getFaceApi() {
  if (!faceapi && typeof window !== "undefined") {
    faceapi = await import("@vladmandic/face-api");
  }
  return faceapi;
}

/**
 * Loads pre-trained face-api neural network models from /models
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const api = await getFaceApi();
      if (!api) return false;

      const MODEL_URL = "/models";

      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        api.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error("[FaceApi] Failed to load models:", err);
      loadingPromise = null;
      return false;
    }
  })();

  return loadingPromise;
}

export interface DetectedFaceData {
  descriptor: number[];
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score: number;
}

export interface FaceLivenessData {
  detected: boolean;
  descriptor?: number[];
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score?: number;
  isBlinking: boolean;
  leftEar: number;
  rightEar: number;
  avgEar: number;
  isSmiling: boolean;
  smileScore: number;
  expressions?: Record<string, number>;
}

/**
 * Calculates Eye Aspect Ratio (EAR) from 6 landmark points of an eye
 */
function calculateEAR(eyeLandmarks: { x: number; y: number }[]): number {
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.3;
  // Points: 0: outer corner, 1: top-left, 2: top-right, 3: inner corner, 4: bottom-right, 5: bottom-left
  const v1 = Math.hypot(eyeLandmarks[1].x - eyeLandmarks[5].x, eyeLandmarks[1].y - eyeLandmarks[5].y);
  const v2 = Math.hypot(eyeLandmarks[2].x - eyeLandmarks[4].x, eyeLandmarks[2].y - eyeLandmarks[4].y);
  const h = Math.hypot(eyeLandmarks[0].x - eyeLandmarks[3].x, eyeLandmarks[0].y - eyeLandmarks[3].y);
  return (v1 + v2) / (2.0 * (h || 1));
}

/**
 * Detects single face from video/image element and extracts 128-float descriptor vector
 */
export async function detectFaceWithDescriptor(
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<DetectedFaceData | null> {
  const api = await getFaceApi();
  if (!api || !modelsLoaded) {
    const loaded = await loadFaceApiModels();
    if (!loaded) return null;
  }

  const options = new api.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detection = await api
    .detectSingleFace(element, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) {
    return null;
  }

  return {
    descriptor: Array.from(detection.descriptor),
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
    score: detection.detection.score,
  };
}

/**
 * Full Liveness and Biometric Inspector (Detects Face, Blink EAR, Smile Expression, and Descriptor)
 */
export async function detectFaceLivenessAndDescriptor(
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceLivenessData> {
  const api = await getFaceApi();
  if (!api || !modelsLoaded) {
    const loaded = await loadFaceApiModels();
    if (!loaded) return { detected: false, isBlinking: false, leftEar: 0, rightEar: 0, avgEar: 0, isSmiling: false, smileScore: 0 };
  }

  const options = new api.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

  try {
    const detection = await api
      .detectSingleFace(element, options)
      .withFaceLandmarks(true)
      .withFaceExpressions()
      .withFaceDescriptor();

    if (!detection) {
      return { detected: false, isBlinking: false, leftEar: 0, rightEar: 0, avgEar: 0, isSmiling: false, smileScore: 0 };
    }

    // Extract eye landmarks
    // Left eye: landmarks 36 to 41, Right eye: landmarks 42 to 47
    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEar = calculateEAR(leftEye);
    const rightEar = calculateEAR(rightEye);
    const avgEar = (leftEar + rightEar) / 2;

    // A blink is detected when average EAR drops below 0.225
    const isBlinking = avgEar < 0.225;

    // Smile detection via happy expression probability (> 0.60)
    const smileScore = detection.expressions?.happy || 0;
    const isSmiling = smileScore >= 0.60;

    return {
      detected: true,
      descriptor: detection.descriptor ? Array.from(detection.descriptor) : undefined,
      box: {
        x: detection.detection.box.x,
        y: detection.detection.box.y,
        width: detection.detection.box.width,
        height: detection.detection.box.height,
      },
      score: detection.detection.score,
      isBlinking,
      leftEar,
      rightEar,
      avgEar,
      isSmiling,
      smileScore,
      expressions: detection.expressions ? { ...detection.expressions } : undefined,
    };
  } catch (err) {
    console.error("[FaceApi] Liveness detection error:", err);
    return { detected: false, isBlinking: false, leftEar: 0, rightEar: 0, avgEar: 0, isSmiling: false, smileScore: 0 };
  }
}

/**
 * Takes snapshot of the video frame or crops face area as JPEG Base64
 */
export function captureFrameBase64(
  video: HTMLVideoElement,
  box?: { x: number; y: number; width: number; height: number }
): string | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (box && box.width > 0 && box.height > 0) {
    // Add padding around face crop
    const padX = box.width * 0.25;
    const padY = box.height * 0.35;
    const cropX = Math.max(0, box.x - padX);
    const cropY = Math.max(0, box.y - padY);
    const cropW = Math.min(video.videoWidth - cropX, box.width + padX * 2);
    const cropH = Math.min(video.videoHeight - cropY, box.height + padY * 2);

    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  } else {
    canvas.width = Math.min(480, video.videoWidth);
    canvas.height = Math.min(480, video.videoHeight);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/jpeg", 0.85);
}
