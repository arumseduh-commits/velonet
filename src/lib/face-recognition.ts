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
 * Converts Euclidean distance to a friendly similarity percentage (0% - 100%).
 * Distance 0.0 -> 100%
 * Distance 0.25 -> 75%
 * Distance 0.50 -> 50%
 */
export function calculateSimilarityPercentage(distance: number): number {
  const percentage = (1 - distance) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage * 10) / 10));
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
  threshold = 0.50
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
  // 1. Fetch all candidate users who have registered their face
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

  // 2. Perform Biometric Face Matching
  const matchResult = findBestFaceMatch(queryDescriptor, enrolledUsers, threshold);

  if (!matchResult.isMatch || !matchResult.matchedUser) {
    return {
      success: false,
      code: "UNKNOWN_FACE",
      message:
        "❌ Wajah Tidak Dikenali / Bukan Anggota: Wajah Anda belum terdaftar sebagai anggota Velocity. Silakan hubungi Pembina atau lakukan perekaman wajah.",
    };
  }

  const detectedUser = matchResult.matchedUser;
  const detectedName = detectedUser.name || "Peserta";
  const detectedClass = detectedUser.studentClass || "-";
  const similarity = matchResult.similarity;

  // 3. Verify Account Ownership (Anti-Titip Absen)
  if (loggedInUserId && loggedInUserId !== detectedUser.id) {
    const loggedInUser = await prisma.user.findUnique({
      where: { id: loggedInUserId },
      select: { name: true, studentClass: true },
    });

    const loggedInName = loggedInUser?.name || "Akun Anda";

    return {
      success: false,
      code: "ACCOUNT_MISMATCH",
      message: `⚠️ Terdeteksi Wajah: ${detectedName} (${detectedClass}) [Kemiripan: ${similarity}%]\n\n⛔ ABSENSI DITOLAK: Anda sedang login sebagai "${loggedInName}", namun wajah di kamera terdeteksi sebagai "${detectedName}". Dilarang melakukan titip absen!`,
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
      message: `⏳ Tidak ada Sesi Pertemuan Velocity yang sedang aktif saat ini. Absensi wajah hanya dapat dilakukan sesuai jadwal kumpul.`,
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
      message: `📍 LOKASI GPS TIDAK TERDETEKSI\n\nSesi "${session.title}" mewajibkan verifikasi lokasi di "${session.locationName || 'Titik Kumpul'}". Mohon aktifkan GPS perangkat Anda dan izinkan akses lokasi pada browser HP Anda.`,
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
          ? `${(dist / 1000).toFixed(1)} km (${dist.toLocaleString("id-ID")} meter)`
          : `${dist} meter`
        : "tidak terjangkau";

    return {
      success: false,
      code: "OUT_OF_RADIUS",
      message: `🔴 ABSENSI DITOLAK (DI LUAR AREA)\n\nWajah teridentifikasi: ${detectedName} (${similarity}%)\nLokasi Anda terdeteksi berjarak ${formattedDistance} dari "${session.locationName || session.title}" (Batas radius: ${session.radiusMeter} meter).\n\nMohon lakukan absensi saat Anda sudah berada di lokasi pertemuan.`,
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
      message: `ℹ️ ANDA SUDAH MELAKUKAN ABSENSI\n\nHalo Kak *${detectedName}*! Anda sudah tercatat *HADIR* untuk sesi "${session.title}" pada pukul *${originalTimeStr} WIB*.\n\nTidak perlu melakukan absensi ulang. Selamat mengikuti kegiatan! 🎉`,
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

  const distText =
    sessionResult.distanceMeter !== null
      ? `${sessionResult.distanceMeter} Meter`
      : "Lokasi Tervalidasi";

  return {
    success: true,
    code: "SUCCESS",
    message: `🟢 ABSENSI BERHASIL!\n\n👤 Nama: ${detectedName}\n🏫 Kelas: ${detectedClass}\n🎯 Kemiripan Wajah: ${similarity}%\n📌 Sesi: ${session.title}\n📍 Lokasi: ${session.locationName || "Titik Kumpul"} (${distText})\n⏰ Waktu: ${timeStr} WIB`,
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
