import { PrismaClient } from "@prisma/client";
import { calculateHaversineDistance } from "./attendance";

/**
 * Calculates Euclidean distance between two 128-dimensional face descriptor vectors.
 * A distance <= 0.50 typically indicates the same person.
 */
export function calculateEuclideanDistance(
  desc1: number[],
  desc2: number[]
): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) {
    return 1.0;
  }

  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Converts Euclidean distance to a friendly calibrated similarity percentage (0% - 100%).
 * Uses a non-linear biometric curve so that:
 * - Distance <= 0.20 -> 94% - 100% (Identical / near-perfect)
 * - Distance 0.35 -> ~85% - 90% (Very good match)
 * - Distance 0.45 -> ~76% - 80% (Acceptable match for low-end cameras)
 * - Distance 0.50 -> ~70% (Standard acceptance threshold)
 * - Distance > 0.60 -> Rapidly drops below 50%
 */
export function calculateSimilarityPercentage(distance: number): number {
  if (distance <= 0) return 100;

  let score: number;
  if (distance <= 0.20) {
    score = 100 - (distance / 0.20) * 6; // 100% -> 94%
  } else if (distance <= 0.50) {
    score = 94 - ((distance - 0.20) / 0.30) * 24; // 94% -> 70%
  } else if (distance <= 0.75) {
    score = 70 - ((distance - 0.50) / 0.25) * 45; // 70% -> 25%
  } else {
    score = Math.max(0, 25 - ((distance - 0.75) / 0.25) * 25);
  }

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export interface CandidateUser {
  id: string;
  name: string | null;
  phoneNumber: string;
  studentClass: string | null;
  gender: string | null;
  faceDescriptor: string | null;
  facePhoto: string | null;
  status?: string;
  isCompleted?: boolean;
}

export interface BestFaceMatchResult {
  matchedUser: CandidateUser | null;
  distance: number;
  similarity: number;
  isMatch: boolean;
}

/**
 * Finds the closest matching user from enrolled users.
 * Default matching threshold is 0.50 (Euclidean distance).
 */
export function findBestFaceMatch(
  queryDescriptor: number[],
  candidates: CandidateUser[],
  threshold = 0.56
): BestFaceMatchResult {
  let minDistance = Infinity;
  let bestUser: CandidateUser | null = null;

  for (const candidate of candidates) {
    if (!candidate.faceDescriptor) continue;

    try {
      const parsedDescriptor: number[] = JSON.parse(candidate.faceDescriptor);
      if (Array.isArray(parsedDescriptor) && parsedDescriptor.length === queryDescriptor.length) {
        const dist = calculateEuclideanDistance(queryDescriptor, parsedDescriptor);
        if (dist < minDistance) {
          minDistance = dist;
          bestUser = candidate;
        }
      }
    } catch (e) {
      // Ignore JSON parse errors for corrupt descriptors
    }
  }

  const isMatch = minDistance <= threshold && bestUser !== null;
  const similarity = isFinite(minDistance)
    ? calculateSimilarityPercentage(minDistance)
    : 0;

  return {
    matchedUser: bestUser,
    distance: minDistance,
    similarity,
    isMatch,
  };
}

export interface NearestSessionResult {
  session: any | null;
  distanceMeter: number | null;
  isWithinRadius: boolean;
  activeSessionsCount: number;
  nearestSessionTitle?: string;
  nearestLocationName?: string;
}

/**
 * Smart Auto-Location Matcher:
 * Finds the open meeting session whose location matches the student's GPS coordinates.
 * If multiple sessions are running concurrently at different places (e.g. Ruang Caprice & Ruang BI),
 * it selects the one where the user is currently located (within radius).
 */
export async function findNearestActiveMeetingSession(
  prisma: PrismaClient,
  latitude?: number,
  longitude?: number
): Promise<NearestSessionResult> {
  const now = new Date();

  const openSessions = await prisma.meetingSession.findMany({
    where: {
      isActive: true,
      isCancelled: false,
      startTime: { lte: now },
      endTime: { gte: now },
    },
    orderBy: { date: "desc" },
  });

  if (openSessions.length === 0) {
    return {
      session: null,
      distanceMeter: null,
      isWithinRadius: false,
      activeSessionsCount: 0,
    };
  }

  // If GPS is not provided, return the first active session if available
  if (latitude == null || longitude == null) {
    return {
      session: openSessions[0],
      distanceMeter: null,
      isWithinRadius: false,
      activeSessionsCount: openSessions.length,
    };
  }

  // Calculate distance to each active session location
  let closestSession: any = null;
  let minDistance = Infinity;

  for (const sess of openSessions) {
    if (sess.latitude != null && sess.longitude != null) {
      const dist = calculateHaversineDistance(
        latitude,
        longitude,
        sess.latitude,
        sess.longitude
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestSession = sess;
      }
    } else {
      // Session without GPS coordinates is considered a fallback
      if (!closestSession) {
        closestSession = sess;
      }
    }
  }

  if (!closestSession) {
    closestSession = openSessions[0];
  }

  const roundedDistance = isFinite(minDistance) ? Math.round(minDistance) : null;
  const isWithinRadius =
    closestSession.latitude == null ||
    closestSession.longitude == null ||
    (roundedDistance !== null && roundedDistance <= closestSession.radiusMeter);

  return {
    session: closestSession,
    distanceMeter: roundedDistance,
    isWithinRadius,
    activeSessionsCount: openSessions.length,
    nearestSessionTitle: closestSession.title,
    nearestLocationName: closestSession.locationName || "Titik Kumpul",
  };
}

export interface ProcessFaceAttendanceParams {
  prisma: PrismaClient;
  queryDescriptor: number[];
  loggedInUserId?: string; // If student is logged in
  latitude?: number;
  longitude?: number;
  photoBase64?: string;
  threshold?: number;
}

export interface ProcessFaceAttendanceResult {
  success: boolean;
  code:
    | "SUCCESS"
    | "ALREADY_CHECKED_IN"
    | "ACCOUNT_MISMATCH"
    | "UNKNOWN_FACE"
    | "NO_ACTIVE_SESSION"
    | "OUT_OF_RADIUS"
    | "LOCATION_REQUIRED"
    | "NOT_ENROLLED"
    | "ERROR";
  message: string;
  detectedUser?: {
    id: string;
    name: string;
    studentClass: string;
    phoneNumber: string;
    facePhoto: string | null;
  };
  loggedInName?: string;
  similarity?: number;
  distanceMeter?: number | null;
  sessionTitle?: string;
  locationName?: string;
  checkInTime?: string;
}

/**
 * Main Face Recognition Attendance Verifier
 */
export async function processFaceAttendance({
  prisma,
  queryDescriptor,
  loggedInUserId,
  latitude,
  longitude,
  photoBase64,
  threshold = 0.50,
}: ProcessFaceAttendanceParams): Promise<ProcessFaceAttendanceResult> {
  let detectedUser: {
    id: string;
    name: string | null;
    phoneNumber: string;
    studentClass: string | null;
    gender: string | null;
    facePhoto: string | null;
  };
  let detectedName: string;
  let detectedClass: string;
  let similarity: number;

  if (loggedInUserId) {
    // 1:1 Direct Verification for logged-in student (eliminates false 1:N collisions on low-cost cameras)
    const loggedInUser = await prisma.user.findUnique({
      where: { id: loggedInUserId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        studentClass: true,
        gender: true,
        faceDescriptor: true,
        facePhoto: true,
        isExcluded: true,
      },
    });

    if (!loggedInUser || !loggedInUser.faceDescriptor) {
      return {
        success: false,
        code: "NOT_ENROLLED",
        message: "Anda belum mendaftarkan biometrik wajah. Silakan rekam wajah terlebih dahulu di menu Perekaman Wajah.",
      };
    }

    let enrolledDescriptor: number[];
    try {
      enrolledDescriptor = JSON.parse(loggedInUser.faceDescriptor);
    } catch {
      return {
        success: false,
        code: "ERROR",
        message: "Format biometrik wajah akun Anda di sistem rusak. Silakan lakukan rekam ulang wajah.",
      };
    }

    const dist = calculateEuclideanDistance(queryDescriptor, enrolledDescriptor);
    // Student threshold: 0.52 for mobile phone tolerance in varying lighting conditions
    const studentThreshold = Math.max(threshold, 0.52);
    const isMatch = dist <= studentThreshold;
    similarity = calculateSimilarityPercentage(dist);

    if (!isMatch) {
      return {
        success: false,
        code: "ACCOUNT_MISMATCH",
        message: `Wajah di kamera tidak cocok dengan profil biometrik akun Anda (${similarity}%). Pastikan pencahayaan cukup dan wajah Anda sendiri yang menghadap kamera.`,
        detectedUser: {
          id: loggedInUser.id,
          name: loggedInUser.name || "Peserta",
          studentClass: loggedInUser.studentClass || "-",
          phoneNumber: loggedInUser.phoneNumber,
          facePhoto: loggedInUser.facePhoto,
        },
        loggedInName: loggedInUser.name || "Akun Anda",
        similarity,
      };
    }

    detectedUser = loggedInUser;
    detectedName = loggedInUser.name || "Peserta";
    detectedClass = loggedInUser.studentClass || "-";
  } else {
    // 1:N Global Search for Public Kiosk Terminal (admin/face-terminal)
    const enrolledUsers = await prisma.user.findMany({
      where: {
        faceDescriptor: { not: null },
        isExcluded: false,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        studentClass: true,
        gender: true,
        faceDescriptor: true,
        facePhoto: true,
      },
    });

    if (enrolledUsers.length === 0) {
      return {
        success: false,
        code: "NOT_ENROLLED",
        message: "Belum ada data wajah peserta yang terdaftar di sistem. Silakan rekam wajah terlebih dahulu.",
      };
    }

    const matchResult = findBestFaceMatch(queryDescriptor, enrolledUsers, threshold);

    if (!matchResult.isMatch || !matchResult.matchedUser) {
      return {
        success: false,
        code: "UNKNOWN_FACE",
        message: "Wajah Anda belum terdaftar di sistem. Silakan hubungi admin atau rekam wajah di menu profil.",
      };
    }

    detectedUser = matchResult.matchedUser;
    detectedName = detectedUser.name || "Peserta";
    detectedClass = detectedUser.studentClass || "-";
    similarity = matchResult.similarity;
  }

  // 4. Smart Auto-Location & Session Detection
  const sessionResult = await findNearestActiveMeetingSession(
    prisma,
    latitude,
    longitude
  );

  if (!sessionResult.session) {
    return {
      success: false,
      code: "NO_ACTIVE_SESSION",
      message: "Tidak ada sesi pertemuan yang sedang aktif saat ini.",
      detectedUser: {
        id: detectedUser.id,
        name: detectedName,
        studentClass: detectedClass,
        phoneNumber: detectedUser.phoneNumber,
        facePhoto: detectedUser.facePhoto,
      },
      similarity,
    };
  }

  const session = sessionResult.session;

  // 5. Verify GPS Geofence Distance
  const requiresGps = session.latitude != null && session.longitude != null;

  if (requiresGps && (latitude == null || longitude == null)) {
    return {
      success: false,
      code: "LOCATION_REQUIRED",
      message: `Sesi "${session.title}" mewajibkan verifikasi lokasi di ${session.locationName || 'titik kumpul'}. Pastikan GPS perangkat Anda aktif.`,
      detectedUser: {
        id: detectedUser.id,
        name: detectedName,
        studentClass: detectedClass,
        phoneNumber: detectedUser.phoneNumber,
        facePhoto: detectedUser.facePhoto,
      },
      similarity,
      sessionTitle: session.title,
      locationName: session.locationName || "Lokasi Pertemuan",
    };
  }

  if (requiresGps && !sessionResult.isWithinRadius) {
    const dist = sessionResult.distanceMeter;
    const formattedDistance =
      dist !== null
        ? dist > 1000
          ? `${(dist / 1000).toFixed(1)} km (${dist.toLocaleString("id-ID")} m)`
          : `${dist} meter`
        : "tidak terjangkau";

    return {
      success: false,
      code: "OUT_OF_RADIUS",
      message: `Posisi Anda terdeteksi ${formattedDistance} dari "${session.locationName || session.title}" (Batas: ${session.radiusMeter} meter).`,
      detectedUser: {
        id: detectedUser.id,
        name: detectedName,
        studentClass: detectedClass,
        phoneNumber: detectedUser.phoneNumber,
        facePhoto: detectedUser.facePhoto,
      },
      similarity,
      distanceMeter: sessionResult.distanceMeter,
      sessionTitle: session.title,
      locationName: session.locationName || "Lokasi Pertemuan",
    };
  }

  // 6. Check if participant has already checked in for this session
  const existingAttendance = await prisma.attendance.findUnique({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId: detectedUser.id,
      },
    },
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (existingAttendance && existingAttendance.status === "HADIR") {
    const originalTimeStr = existingAttendance.checkInTime
      ? new Date(existingAttendance.checkInTime).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : timeStr;

    return {
      success: true,
      code: "ALREADY_CHECKED_IN",
      message: `Anda sudah tercatat hadir untuk sesi "${session.title}" pada pukul ${originalTimeStr} WIB.`,
      detectedUser: {
        id: detectedUser.id,
        name: detectedName,
        studentClass: detectedClass,
        phoneNumber: detectedUser.phoneNumber,
        facePhoto: detectedUser.facePhoto,
      },
      similarity,
      distanceMeter: existingAttendance.distanceMeter ?? sessionResult.distanceMeter,
      sessionTitle: session.title,
      locationName: session.locationName || "Titik Kumpul",
      checkInTime: originalTimeStr,
    };
  }

  // 7. Record First-time Attendance in Database
  await prisma.attendance.upsert({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId: detectedUser.id,
      },
    },
    create: {
      sessionId: session.id,
      userId: detectedUser.id,
      status: "HADIR",
      method: "FACE_LOCATION",
      latitude: latitude || null,
      longitude: longitude || null,
      distanceMeter: sessionResult.distanceMeter,
      faceConfidence: similarity / 100,
      facePhotoCaptured: photoBase64 || null,
      checkInTime: now,
    },
    update: {
      status: "HADIR",
      method: "FACE_LOCATION",
      latitude: latitude || null,
      longitude: longitude || null,
      distanceMeter: sessionResult.distanceMeter,
      faceConfidence: similarity / 100,
      facePhotoCaptured: photoBase64 || null,
      checkInTime: now,
    },
  });

  return {
    success: true,
    code: "SUCCESS",
    message: "Absensi kehadiran Anda berhasil diverifikasi.",
    detectedUser: {
      id: detectedUser.id,
      name: detectedName,
      studentClass: detectedClass,
      phoneNumber: detectedUser.phoneNumber,
      facePhoto: detectedUser.facePhoto,
    },
    similarity,
    distanceMeter: sessionResult.distanceMeter,
    sessionTitle: session.title,
    locationName: session.locationName || "Titik Kumpul",
    checkInTime: timeStr,
  };
}
