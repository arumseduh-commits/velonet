import { prisma } from "./prisma";

export interface AgentToolCall {
  name: string;
  arguments: any;
}

export interface AgentToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute dynamic database query requested by the AI Agent
 */
export async function executeDbQuery({
  entity,
  where,
  take = 10,
  orderBy,
}: {
  entity: string;
  where?: any;
  take?: number;
  orderBy?: any;
}): Promise<AgentToolResult> {
  const safeTake = Math.min(Math.max(1, take || 10), 50);

  try {
    let result: any = null;

    switch (entity.toLowerCase()) {
      case "user":
      case "peserta":
        result = await prisma.user.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            role: true,
            studentClass: true,
            status: true,
            createdAt: true,
          },
        });
        break;

      case "quiz":
      case "kuis":
      case "exam":
        result = await prisma.quiz.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            durationMinutes: true,
            maxStrikes: true,
            createdAt: true,
            _count: { select: { questions: true, attempts: true } },
          },
        });
        break;

      case "meetingsession":
      case "session":
      case "presensi":
        result = await prisma.meetingSession.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            endTime: true,
            locationName: true,
            isActive: true,
            _count: { select: { attendances: true } },
          },
        });
        break;

      case "attendance":
        result = await prisma.attendance.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { checkInTime: "desc" },
          select: {
            id: true,
            userId: true,
            sessionId: true,
            status: true,
            checkInTime: true,
            method: true,
            user: { select: { name: true, phoneNumber: true, studentClass: true } },
          },
        });
        break;

      case "violationlog":
      case "violation":
      case "strike":
        result = await prisma.examViolationLog.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { createdAt: "desc" },
          select: {
            id: true,
            attemptId: true,
            violationType: true,
            strikeNumber: true,
            details: true,
            createdAt: true,
          },
        });
        break;

      case "course":
      case "kursus":
        result = await prisma.course.findMany({
          where,
          take: safeTake,
          orderBy: orderBy || { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            slug: true,
            isPublished: true,
            _count: { select: { chapters: true, enrollments: true } },
          },
        });
        break;

      default:
        return {
          tool: "db_query",
          success: false,
          error: `Entitas '${entity}' tidak didukung. Pilihan: user, quiz, meetingSession, attendance, violationLog, course`,
        };
    }

    return {
      tool: "db_query",
      success: true,
      data: result,
    };
  } catch (err: any) {
    console.error("[Agent Tool db_query Error]", err);
    return {
      tool: "db_query",
      success: false,
      error: err.message || "Gagal mengeksekusi query database.",
    };
  }
}

/**
 * Generate standard SVG scientific / educational diagram for questions
 */
export function executeGenerateSvg({
  type,
  title,
}: {
  type: "coordinate" | "flowchart" | "bar_chart" | "circuit" | "molecule";
  title?: string;
}): AgentToolResult {
  const safeTitle = title || "Diagram Ilmiah";

  let svgContent = "";

  switch (type) {
    case "coordinate":
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" class="w-full h-auto bg-slate-900 rounded-xl p-2">
        <text x="160" y="25" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">${safeTitle}</text>
        <line x1="30" y1="160" x2="290" y2="160" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)" />
        <line x1="50" y1="180" x2="50" y2="40" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)" />
        <path d="M 50 160 Q 150 40 270 120" stroke="#3b82f6" stroke-width="3" fill="none" />
        <circle cx="150" cy="80" r="4" fill="#f59e0b" />
        <text x="150" y="70" fill="#f59e0b" font-size="10" text-anchor="middle">Titik Puncak (h_max)</text>
        <text x="280" y="175" fill="#94a3b8" font-size="10">Waktu (s)</text>
        <text x="20" y="45" fill="#94a3b8" font-size="10">v (m/s)</text>
      </svg>`;
      break;

    case "bar_chart":
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" class="w-full h-auto bg-slate-900 rounded-xl p-2">
        <text x="160" y="20" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">${safeTitle}</text>
        <line x1="40" y1="150" x2="290" y2="150" stroke="#64748b" stroke-width="2" />
        <rect x="60" y="70" width="35" height="80" fill="#3b82f6" rx="4" />
        <rect x="120" y="40" width="35" height="110" fill="#10b981" rx="4" />
        <rect x="180" y="90" width="35" height="60" fill="#f59e0b" rx="4" />
        <rect x="240" y="55" width="35" height="95" fill="#8b5cf6" rx="4" />
        <text x="77" y="165" fill="#94a3b8" font-size="9" text-anchor="middle">A</text>
        <text x="137" y="165" fill="#94a3b8" font-size="9" text-anchor="middle">B</text>
        <text x="197" y="165" fill="#94a3b8" font-size="9" text-anchor="middle">C</text>
        <text x="257" y="165" fill="#94a3b8" font-size="9" text-anchor="middle">D</text>
      </svg>`;
      break;

    default:
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" class="w-full h-auto bg-slate-900 rounded-xl p-2">
        <text x="160" y="25" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">${safeTitle}</text>
        <rect x="40" y="50" width="90" height="70" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2" />
        <text x="85" y="90" fill="#f8fafc" font-size="11" text-anchor="middle">Input A</text>
        <line x1="130" y1="85" x2="190" y2="85" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4" />
        <rect x="190" y="50" width="90" height="70" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2" />
        <text x="235" y="90" fill="#f8fafc" font-size="11" text-anchor="middle">Output B</text>
      </svg>`;
      break;
  }

  return {
    tool: "generate_svg",
    success: true,
    data: { svg: svgContent },
  };
}
