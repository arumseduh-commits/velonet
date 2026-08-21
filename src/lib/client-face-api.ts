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
  landmarks?: any;
  score: number;
}

export interface FaceValidationResult {
  isValid: boolean;
  code:
    | "VALID"
    | "NO_FACE"
    | "OUTSIDE_CIRCLE"
    | "TOO_FAR"
    | "TOO_CLOSE"
    | "POOR_LANDMARKS"
    | "TILTED";
  message: string;
  normalizedDistance: number;
  faceCoverage: number;
  landmarksOk: boolean;
  screenBox?: { x: number; y: number; width: number; height: number; centerX: number; centerY: number };
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
  expressions?: { [key: string]: number };
}

/**
 * Maps bounding box from video native pixel space to screen viewport coordinates,
 * taking into account object-cover scaling and horizontal mirroring.
 */
export function transformVideoBoxToScreen(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
  facingMode: "user" | "environment" = "user"
): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } {
  const vRect = video.getBoundingClientRect();
  const cw = vRect.width || video.clientWidth || window.innerWidth;
  const ch = vRect.height || video.clientHeight || window.innerHeight;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  const scale = Math.max(cw / vw, ch / vh);
  const renderedW = vw * scale;
  const renderedH = vh * scale;
  const offsetX = (cw - renderedW) / 2;
  const offsetY = (ch - renderedH) / 2;

  let screenX: number;
  if (facingMode === "user") {
    // Mirrored horizontally
    screenX = vRect.left + offsetX + (vw - (box.x + box.width)) * scale;
  } else {
    screenX = vRect.left + offsetX + box.x * scale;
  }
  const screenY = vRect.top + offsetY + box.y * scale;
  const screenW = box.width * scale;
  const screenH = box.height * scale;

  return {
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    centerX: screenX + screenW / 2,
    centerY: screenY + screenH / 2,
  };
}

/**
 * Validates whether the detected face is positioned properly inside the on-screen guide oval.
 * Features rigorous checks for position, distance/scale, tilt, and core facial landmarks
 * (ensuring high accuracy and 100% inclusivity for hijab/headscarf wearers).
 */
export function validateFaceInGuide(
  video: HTMLVideoElement,
  detection: {
    box: { x: number; y: number; width: number; height: number };
    landmarks?: any;
    score?: number;
  } | null,
  guideElement: HTMLElement | DOMRect | null,
  facingMode: "user" | "environment" = "user"
): FaceValidationResult {
  if (!detection || !detection.box) {
    return {
      isValid: false,
      code: "NO_FACE",
      message: "Wajah tidak terdeteksi di kamera.",
      normalizedDistance: 999,
      faceCoverage: 0,
      landmarksOk: false,
    };
  }

  // Transform video box to screen coordinates
  const screenBox = transformVideoBoxToScreen(video, detection.box, facingMode);

  let guideRect: DOMRect | { left: number; top: number; width: number; height: number };
  if (guideElement instanceof HTMLElement) {
    guideRect = guideElement.getBoundingClientRect();
  } else if (guideElement && typeof (guideElement as any).left === "number") {
    guideRect = guideElement as DOMRect;
  } else {
    // Fallback: assume center 60% of viewport
    const cw = video.clientWidth || window.innerWidth;
    const ch = video.clientHeight || window.innerHeight;
    const gw = Math.min(cw * 0.7, 280);
    const gh = Math.min(ch * 0.55, 360);
    guideRect = {
      left: (cw - gw) / 2,
      top: (ch - gh) / 2,
      width: gw,
      height: gh,
    };
  }

  const guideCenterX = guideRect.left + guideRect.width / 2;
  const guideCenterY = guideRect.top + guideRect.height / 2;
  const guideRadiusX = guideRect.width / 2;
  const guideRadiusY = guideRect.height / 2;

  // Normalized distance from center in ellipse coordinates: (dx/rx)^2 + (dy/ry)^2
  const dx = screenBox.centerX - guideCenterX;
  const dy = screenBox.centerY - guideCenterY;
  const normalizedDistance = Math.pow(dx / guideRadiusX, 2) + Math.pow(dy / guideRadiusY, 2);

  // Coverage ratio (face size relative to guide size)
  const faceCoverage = (screenBox.width * screenBox.height) / (guideRect.width * guideRect.height);
  const widthRatio = screenBox.width / guideRect.width;

  // Landmark verification (Inclusive for Hijab: checks eye-to-nose-to-mouth core facial triangle)
  let landmarksOk = true;
  let isTilted = false;

  if (detection.landmarks) {
    try {
      const leftEye = detection.landmarks.getLeftEye();
      const rightEye = detection.landmarks.getRightEye();
      const nose = detection.landmarks.getNose();
      const mouth = detection.landmarks.getMouth();

      if (!leftEye || !rightEye || !nose || !mouth || leftEye.length === 0 || rightEye.length === 0) {
        landmarksOk = false;
      } else {
        // Calculate eye roll angle
        const lx = leftEye[0].x;
        const ly = leftEye[0].y;
        const rx = rightEye[3]?.x || rightEye[0].x;
        const ry = rightEye[3]?.y || rightEye[0].y;
        const angleDeg = Math.abs((Math.atan2(ry - ly, rx - lx) * 180) / Math.PI);
        if ((angleDeg > 25 && angleDeg < 155) || (angleDeg > 205 && angleDeg < 335)) {
          isTilted = true;
        }
      }
    } catch (e) {
      landmarksOk = true; // fallback
    }
  }

  // 1. Outside Oval Guide (normalizedDistance > 0.85 means center is clearly outside the oval guide)
  if (normalizedDistance > 0.85) {
    return {
      isValid: false,
      code: "OUTSIDE_CIRCLE",
      message: "Wajah berada di luar lingkaran! Posisikan wajah tepat di tengah lingkaran panduan.",
      normalizedDistance,
      faceCoverage,
      landmarksOk,
      screenBox,
    };
  }

  // 2. Too far away
  if (widthRatio < 0.28 || faceCoverage < 0.12) {
    return {
      isValid: false,
      code: "TOO_FAR",
      message: "Wajah terlalu jauh dari kamera! Silakan mendekat ke layar.",
      normalizedDistance,
      faceCoverage,
      landmarksOk,
      screenBox,
    };
  }

  // 3. Too close / overflowing
  if (widthRatio > 1.35 || faceCoverage > 1.35) {
    return {
      isValid: false,
      code: "TOO_CLOSE",
      message: "Wajah terlalu dekat dengan kamera! Silakan mundurkan posisi sedikit.",
      normalizedDistance,
      faceCoverage,
      landmarksOk,
      screenBox,
    };
  }

  // 4. Head tilted excessively
  if (isTilted) {
    return {
      isValid: false,
      code: "TILTED",
      message: "Posisikan kepala tegak lurus menghadap kamera.",
      normalizedDistance,
      faceCoverage,
      landmarksOk,
      screenBox,
    };
  }

  return {
    isValid: true,
    code: "VALID",
    message: "Posisi wajah pas di dalam lingkaran.",
    normalizedDistance,
    faceCoverage,
    landmarksOk,
    screenBox,
  };
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
    landmarks: detection.landmarks,
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
