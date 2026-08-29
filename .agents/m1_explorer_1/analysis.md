# Milestone 1: Analysis & Implementation Specification
## Window of Availability Scheduling (Admin UI & APIs)

**Author**: `m1_explorer_1`  
**Date**: 2026-08-30  
**Target Areas**: 
- `src/app/admin/exams/create/page.tsx`
- `src/app/admin/exams/[quizId]/edit/page.tsx`
- `src/app/admin/exams/page.tsx`
- `src/app/api/admin/exams/route.ts`
- `src/app/api/admin/exams/[quizId]/route.ts`

---

## 1. Executive Summary & Problem Scope

VeloNet CBT requires a **Window of Availability Scheduling** mechanism allowing administrators/teachers to configure when an exam is open (`openAt`) and closed (`closeAt`). 
This milestone establishes the admin management interface, validation rules, timezone-safe date-time picker conversions, status badge indicators in the admin exam list, and backend persistence.

---

## 2. Codebase Review & Audit

### 2.1 Prisma Schema (`prisma/schema.prisma`)
- **Status**: Verified ✅
- **Location**: `prisma/schema.prisma` lines 304–305 on model `Quiz`:
  ```prisma
  openAt      DateTime? // Waktu Mulai / Buka Ujian
  closeAt     DateTime? // Waktu Selesai / Tutup Ujian
  ```
- **Finding**: The database schema already includes `openAt` and `closeAt` as nullable `DateTime` fields.

---

### 2.2 Backend APIs Audit

#### 2.2.1 `src/app/api/admin/exams/route.ts`
- **GET handler**:
  - Returns `openAt: q.openAt ? q.openAt.toISOString() : null`
  - Returns `closeAt: q.closeAt ? q.closeAt.toISOString() : null`
- **POST handler**:
  - Receives `openAt` and `closeAt` from the request body.
  - Validates date validity via `isNaN(new Date(...).getTime())`.
  - Enforces chronological validation:
    ```ts
    if (parsedOpenAt && parsedCloseAt && parsedOpenAt >= parsedCloseAt) {
      return NextResponse.json(
        { success: false, error: "Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)." },
        { status: 400 }
      );
    }
    ```
  - Persists `openAt: parsedOpenAt` and `closeAt: parsedCloseAt` in `prisma.quiz.create`.

#### 2.2.2 `src/app/api/admin/exams/[quizId]/route.ts`
- **GET handler**:
  - Returns complete `quiz` object where `openAt` and `closeAt` are serialized as ISO 8601 strings.
- **PATCH handler**:
  - Handles updating `openAt` and `closeAt` (`null` or ISO string).
  - Validates `effectiveOpenAt` vs `effectiveCloseAt` chronological order.
  - Persists updates via `prisma.quiz.update`.
- **Verdict**: Backend APIs are fully functional and secure.

---

### 2.3 Admin Exam Form Analysis (`create/page.tsx` & `[quizId]/edit/page.tsx`)

#### Issues Identified:
1. **Missing Pre-Submit Validation in Frontend Form**:
   - In `create/page.tsx` and `[quizId]/edit/page.tsx`, `handleSaveExam` does not perform client-side validation for `openAt < closeAt` prior to sending the fetch request.
   - **Requirement**: If both `openAt` and `closeAt` are provided and `new Date(openAt) >= new Date(closeAt)`, block submission and notify the user with `toast.warning("Jadwal tutup ujian harus lebih akhir dari jadwal buka ujian!")`.

2. **Timezone Offset Bug in Edit Page (`[quizId]/edit/page.tsx`)**:
   - In `[quizId]/edit/page.tsx` lines 158–159:
     ```ts
     setOpenAt(q.openAt ? q.openAt.substring(0, 16) : "");
     setCloseAt(q.closeAt ? q.closeAt.substring(0, 16) : "");
     ```
   - **Bug**: `q.openAt` from API is a UTC ISO string (e.g., `"2026-08-30T03:00:00.000Z"`). Calling `.substring(0, 16)` extracts `"2026-08-30T03:00"`.
   - In UTC+7 (Jakarta), local time was `10:00`. The input displays `03:00` (7 hours earlier). When saved without modification, `new Date("2026-08-30T03:00").toISOString()` converts to `"2026-08-29T20:00:00.000Z"`, shifting 7 hours backwards every save!
   - **Solution**: Implement `toLocalDatetimeInputString(isoDateStr)` helper using local date components (`d.getFullYear()`, `d.getMonth()`, `d.getDate()`, `d.getHours()`, `d.getMinutes()`).

3. **User Experience Enhancements**:
   - Add a quick clear button (❌ "Hapus") next to each date-time picker to easily clear a schedule.
   - Display dynamic duration / window status preview (e.g., "📅 Rentang pengerjaan dibuka selama 4 Jam 30 Menit").
   - Display an inline warning badge if `openAt >= closeAt`.

---

### 2.4 Admin Exams List Page Analysis (`src/app/admin/exams/page.tsx`)

#### Issues Identified:
1. **No Schedule or Availability Display**:
   - The exam cards show question count, duration in minutes, anti-cheat tags, PIN, and active/locked student counts.
   - Neither `openAt` nor `closeAt` is displayed.
   - There is no badge indicating whether an exam is:
     - **🟢 Sedang Berlangsung** (Open now)
     - **⏳ Terjadwal** (Upcoming)
     - **🔴 Telah Berakhir** (Closed / Past closeAt)
     - **🌐 Akses Fleksibel** (No schedule constraints)
2. **Filtering by Status**:
   - Adding a quick filter tab (Semua, Sedang Berlangsung, Terjadwal, Telah Berakhir) improves management for schools with multiple concurrent exams.

---

## 3. Detailed Implementation Plan & Proposed Code

### 3.1 Timezone Conversion & Date Helper Functions
Create or integrate the following helper functions in `create/page.tsx`, `[quizId]/edit/page.tsx`, and `exams/page.tsx`:

```ts
/**
 * Convert UTC ISO string to local HTML <input type="datetime-local"> value (YYYY-MM-DDTHH:mm)
 */
export function toLocalDatetimeInputString(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return "";
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format ISO string or Date object for Indonesian UI display
 */
export function formatIndonesianDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}
```

---

### 3.2 Detailed Plan for `src/app/admin/exams/create/page.tsx`

#### Changes:
1. **Validation inside `handleSaveExam`**:
   ```ts
   // Validate Window of Availability
   if (openAt && closeAt) {
     const openTime = new Date(openAt).getTime();
     const closeTime = new Date(closeAt).getTime();
     if (openTime >= closeTime) {
       toast.warning("Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)!");
       return;
     }
   }
   ```
2. **Window of Availability Card UI Enhancement**:
   - Add Clear button on each picker.
   - Add inline duration calculation / helper badge.
   - Add inline error banner if `openAt >= closeAt`.

#### UI Component Preview:
```tsx
{/* Window of Availability (Jadwal Buka & Tutup) */}
<div className="pt-4 border-t border-slate-100 space-y-3">
  <div className="flex items-center justify-between flex-wrap gap-2">
    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
      <Calendar className="w-4 h-4 text-indigo-600" />
      <span>Jadwal Rentang Waktu Ujian Dibuka (Window of Availability)</span>
    </span>
    {openAt && closeAt && new Date(openAt) < new Date(closeAt) && (
      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
        ✓ Rentang Valid: {Math.round((new Date(closeAt).getTime() - new Date(openAt).getTime()) / (1000 * 60))} Menit Terbuka
      </span>
    )}
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* openAt Picker */}
    <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">
          Tanggal & Jam Mulai Dibuka (Buka):
        </label>
        {openAt && (
          <button
            type="button"
            onClick={() => setOpenAt("")}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            Hapus Jadwal
          </button>
        )}
      </div>
      <input
        type="datetime-local"
        value={openAt}
        onChange={(e) => setOpenAt(e.target.value)}
        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <p className="text-[10px] text-slate-500">
        Kosongkan jika siswa dapat langsung mengakses ujian kapan saja.
      </p>
    </div>

    {/* closeAt Picker */}
    <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">
          Tanggal & Jam Ditutup (Selesai):
        </label>
        {closeAt && (
          <button
            type="button"
            onClick={() => setCloseAt("")}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            Hapus Batas
          </button>
        )}
      </div>
      <input
        type="datetime-local"
        value={closeAt}
        onChange={(e) => setCloseAt(e.target.value)}
        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <p className="text-[10px] text-slate-500">
        Kosongkan jika ujian tidak memiliki batas akhir tanggal pengerjaan.
      </p>
    </div>
  </div>

  {openAt && closeAt && new Date(openAt) >= new Date(closeAt) && (
    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
      <span>Perhatian: Jadwal tutup ujian harus lebih akhir daripada jadwal buka ujian.</span>
    </div>
  )}
</div>
```

---

### 3.3 Detailed Plan for `src/app/admin/exams/[quizId]/edit/page.tsx`

#### Changes:
1. **Fix `useEffect` date loading with `toLocalDatetimeInputString`**:
   ```ts
   setOpenAt(toLocalDatetimeInputString(q.openAt));
   setCloseAt(toLocalDatetimeInputString(q.closeAt));
   ```
2. **Validation inside `handleSaveExam`**:
   ```ts
   if (openAt && closeAt) {
     const openTime = new Date(openAt).getTime();
     const closeTime = new Date(closeAt).getTime();
     if (openTime >= closeTime) {
       toast.warning("Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)!");
       return;
     }
   }
   ```
3. **Synchronize Clear & Validation UI**:
   Same enhanced card UI as in `create/page.tsx`.

---

### 3.4 Detailed Plan for `src/app/admin/exams/page.tsx`

#### Changes:
1. **Compute Availability Helper Function**:
   ```ts
   function getExamAvailability(openAt?: string | null, closeAt?: string | null) {
     if (!openAt && !closeAt) {
       return {
         status: "FLEXIBLE",
         label: "Akses Fleksibel",
         badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
         dotClass: "bg-slate-400",
       };
     }

     const now = new Date();
     const openDate = openAt ? new Date(openAt) : null;
     const closeDate = closeAt ? new Date(closeAt) : null;

     if (openDate && now < openDate) {
       return {
         status: "UPCOMING",
         label: "Terjadwal",
         badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
         dotClass: "bg-amber-500",
       };
     }

     if (closeDate && now > closeDate) {
       return {
         status: "CLOSED",
         label: "Telah Berakhir",
         badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
         dotClass: "bg-rose-500",
       };
     }

     return {
       status: "ACTIVE",
       label: "Sedang Berlangsung",
       badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
       dotClass: "bg-emerald-500 animate-ping",
     };
   }
   ```

2. **Exam Card Layout Enhancement**:
   Insert the Schedule & Availability section into the card body:
   ```tsx
   {/* Schedule & Availability Box */}
   <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
     <div className="flex items-center justify-between">
       <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
         <Calendar className="w-3 h-3 text-indigo-600" />
         <span>Jadwal Akses Ujian</span>
       </span>
       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${availability.badgeClass}`}>
         <span className={`w-1.5 h-1.5 rounded-full ${availability.dotClass}`}></span>
         <span>{availability.label}</span>
       </span>
     </div>

     <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1 text-slate-700">
       <div className="truncate">
         <span className="text-slate-400 font-normal">Buka: </span>
         <strong className="text-slate-800 font-mono">
           {exam.openAt ? formatIndonesianDateTime(exam.openAt) : "Kapan Saja"}
         </strong>
       </div>
       <div className="truncate">
         <span className="text-slate-400 font-normal">Tutup: </span>
         <strong className="text-slate-800 font-mono">
           {exam.closeAt ? formatIndonesianDateTime(exam.closeAt) : "Tanpa Batas"}
         </strong>
       </div>
     </div>
   </div>
   ```

3. **Status Filter Tabs (Optional enhancement)**:
   Add category filter pills: `Semua`, `Sedang Berlangsung`, `Terjadwal`, `Telah Berakhir`, `Fleksibel`.

---

## 4. Edge Cases & Robustness Matrix

| # | Edge Case Scenario | Expected Behavior | Verification Rule |
|---|-------------------|-------------------|-------------------|
| 1 | `openAt` and `closeAt` both empty (`""` or `null`) | Exam has flexible window, saved as `null` in DB, displayed as "Akses Fleksibel". | Allowed, no error. |
| 2 | `openAt` is provided, `closeAt` is empty | Exam is restricted to open after `openAt`, but has no closing deadline. | Allowed, status transitions from `UPCOMING` to `ACTIVE` once `now >= openAt`. |
| 3 | `closeAt` is provided, `openAt` is empty | Exam is immediately available until `closeAt`. | Allowed, status is `ACTIVE` until `closeAt`, then becomes `CLOSED`. |
| 4 | `openAt >= closeAt` | Block submission with `toast.warning()` and display inline error banner. | Prevent API call and display clear user message. |
| 5 | Editing existing exam with UTC dates | Form initializes inputs with local time string (`YYYY-MM-DDTHH:mm`) without shifting hours. | Verify `toLocalDatetimeInputString()` is called. |
| 6 | Clearing previously set dates | Submitting sends `openAt: null` and `closeAt: null`, resetting DB fields. | DB fields set to `null`. |

---

## 5. Verification Commands & Steps

1. **Typecheck & Build**:
   ```bash
   npm run build
   ```
   Must pass with 0 TypeScript and ESLint errors.

2. **Manual / API Verification**:
   - Create exam with `openAt = tomorrow 08:00` and `closeAt = tomorrow 10:00`. Verify status badge shows "Terjadwal".
   - Create exam with `openAt = yesterday` and `closeAt = tomorrow`. Verify status badge shows "Sedang Berlangsung".
   - Create exam with `openAt = yesterday` and `closeAt = 1 hour ago`. Verify status badge shows "Telah Berakhir".
   - Edit an existing exam: verify datetime pickers show original local time and clearing them properly updates the database to `null`.
