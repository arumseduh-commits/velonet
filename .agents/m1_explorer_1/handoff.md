# Handoff Report — Milestone 1 Exploration (Admin UI & APIs Scheduling)

## 1. Observation
1. **Prisma Model `Quiz` (`prisma/schema.prisma:304-305`)**:
   `openAt DateTime?` and `closeAt DateTime?` are already defined on the `Quiz` model.
2. **Backend API Endpoints**:
   - `src/app/api/admin/exams/route.ts:39-40, 76-77, 98-120`: `GET` correctly returns ISO strings for `openAt` and `closeAt`. `POST` receives `openAt` and `closeAt`, validates `parsedOpenAt >= parsedCloseAt`, and persists dates.
   - `src/app/api/admin/exams/[quizId]/route.ts:67-68, 89-130`: `PATCH` receives `openAt` and `closeAt`, checks `effectiveOpenAt >= effectiveCloseAt`, and updates Prisma record.
3. **Frontend Exam Creation Form (`src/app/admin/exams/create/page.tsx:130-131, 380-415, 587-625`)**:
   - `openAt` and `closeAt` state and datetime-local inputs exist.
   - Missing client-side chronological validation before `fetch` in `handleSaveExam`.
   - Missing quick clear buttons and inline validation warnings.
4. **Frontend Exam Edit Form (`src/app/admin/exams/[quizId]/edit/page.tsx:158-159, 443-465, 656-694`)**:
   - `setOpenAt(q.openAt ? q.openAt.substring(0, 16) : "")` slices UTC string directly without converting to local time, causing time to shift by timezone offset on every save.
   - Missing client-side chronological validation before `fetch` in `handleSaveExam`.
5. **Frontend Exam List Page (`src/app/admin/exams/page.tsx:200-325`)**:
   - Fetches `openAt` and `closeAt` from `/api/admin/exams`, but does not render schedule times or availability badges ("Sedang Berlangsung", "Terjadwal", "Telah Berakhir", "Akses Fleksibel").

---

## 2. Logic Chain
1. **Timezone Accuracy**:
   - `Date.prototype.toISOString()` produces UTC time (`2026-08-30T03:00:00.000Z`).
   - `<input type="datetime-local">` requires local format (`YYYY-MM-DDTHH:mm`).
   - Directly using `.substring(0, 16)` strips UTC offset, leading to UTC-as-local parsing when saved back.
   - A helper `toLocalDatetimeInputString(isoStr)` reading `d.getFullYear()`, `d.getMonth() + 1`, `d.getDate()`, `d.getHours()`, `d.getMinutes()` ensures 100% accurate 2-way conversion.
2. **Client-Side Validation & Feedback**:
   - Backend returns `400` if `openAt >= closeAt`, but users need instantaneous feedback before making network requests.
   - Validating in `handleSaveExam` with `toast.warning()` from `useDialog()` and inline warning cards prevents unnecessary failed network requests and improves UX.
3. **Admin Situational Awareness**:
   - Displaying computed badges on `admin/exams/page.tsx` allows proctors and teachers to immediately see which exams are currently open, upcoming, expired, or flexible.

---

## 3. Caveats
- Browser support: `<input type="datetime-local">` is supported across all modern mobile and desktop browsers (iOS Safari, Android Chrome, Edge, Chrome, Firefox).
- Flexible exams with no start/end date (`openAt = null, closeAt = null`) must remain accessible at all times without forcing input values.
- Student-side gating and countdown screens are handled in separate runner components (`student/exams` and `student/quiz/[quizId]`).

---

## 4. Conclusion
Milestone 1 Admin UI and APIs require:
1. Client-side chronological validation (`openAt < closeAt`) in `create/page.tsx` and `[quizId]/edit/page.tsx` using `toast.warning()`.
2. Timezone-safe local datetime string conversion helper `toLocalDatetimeInputString()` in `[quizId]/edit/page.tsx`.
3. Date clearing buttons (`Hapus`) and inline validation banners in the Window of Availability schedule card.
4. Schedule display and real-time availability status badges ("Sedang Berlangsung", "Terjadwal", "Telah Berakhir", "Akses Fleksibel") in `admin/exams/page.tsx`.
5. Full design specifications and code samples are documented in `c:\UBIG\VeloNet\.agents\m1_explorer_1\analysis.md`.

---

## 5. Verification Method
1. **Build & Typecheck**:
   ```bash
   npm run build
   ```
2. **Interactive UI Verification**:
   - Create an exam with `openAt = 2026-09-01 10:00` and `closeAt = 2026-09-01 09:00`: verify warning toast and submission block.
   - Create an exam with `openAt = 2026-09-01 08:00` and `closeAt = 2026-09-01 12:00`: verify successful creation and "Terjadwal" badge in list.
   - Edit the created exam: verify `<input type="datetime-local">` preserves `08:00` and `12:00` local time without shifting.
   - Clear the dates and save: verify the exam updates to `null` and displays "Akses Fleksibel" badge.
