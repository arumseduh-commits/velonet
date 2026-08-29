## 2026-08-29T18:53:00Z
You are m1_explorer_1 for Milestone 1 (Window of Availability Scheduling - Admin UI & APIs).
Working directory: c:\UBIG\VeloNet\.agents\m1_explorer_1
Read:
- `c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md`
- `c:\UBIG\VeloNet\PROJECT.md`

Your task:
Analyze and formulate the exact implementation plan for:
1. `src/app/admin/exams/create/page.tsx` and `src/app/admin/exams/[quizId]/edit/page.tsx`:
   - Add Date & Time pickers (`type="datetime-local"`) for `openAt` (Jadwal Buka Ujian) and `closeAt` (Jadwal Tutup Ujian) in the Exam Form / Schedule card.
   - Validation logic: `openAt < closeAt` if both are provided, clear error messages using `useDialog()` toast or inline feedback.
   - Format conversion: converting ISO strings from/to `YYYY-MM-DDTHH:mm` format for `<input type="datetime-local" />`.
   - Handling optional / cleared values (null).
2. `src/app/admin/exams/page.tsx`:
   - Display exam availability status badges (e.g., "Terjadwal", "Sedang Berlangsung", "Telah Berakhir", "Fleksibel") with start/end time display.
3. Review `src/app/api/admin/exams/route.ts` and `src/app/api/admin/exams/[quizId]/route.ts` to ensure `openAt` and `closeAt` are correctly saved and returned.

Write your report to `c:\UBIG\VeloNet\.agents\m1_explorer_1\analysis.md` and `handoff.md`, and send a completion message.
