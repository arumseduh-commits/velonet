<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Custom UI Dialogs Standard (ATURAN MUTLAK UI/UX VELONET)
- **STRICTLY PROHIBITED**: NEVER use native browser dialogs (`alert()`, `confirm()`, `prompt()`).
- **MANDATORY**: Whenever developing new features, confirmation dialogs, or action notifications in the application, ALWAYS use the custom UI Dialog & Toast System (`useDialog()` from `@/components/ui/DialogProvider`).

# Mobile Responsiveness Standard (ATURAN MUTLAK UI/UX RESPONSIVE MOBILE VELONET)
- **MANDATORY**: Setiap kali membuat atau memodifikasi fitur baru, fungsi baru, komponen UI, tabel, atau modal dialog, SELALU pastikan tampilan 100% responsif dan nyaman digunakan di layar HP/Smartphone (`< 640px`).
- **LAYOUT PATTERNS**:
  - Datatable: Gunakan `overflow-x-auto` pada wrapper tabel agar dapat di-swipe di HP tanpa merusak layout.
  - Header & Action Buttons: Gunakan `flex-col sm:flex-row flex-wrap` agar tombol aksi menumpuk rapi di HP dan sejajar horizontal di desktop.
  - Stat Cards: Gunakan `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` agar kartu statistik menyesuaikan lebar layar.
  - Modal Dialogs: Gunakan `w-full max-w-lg mx-auto` agar modal muat di layar HP tanpa terpotong.
  - Sidebar: Gunakan mobile drawer dengan tombol hamburger menu (`Menu`) di header seluler.

# GitHub Deployment & Sync Standard (ATURAN MUTLAK DEPLOY GITHUB VELONET)
- **MANDATORY**: Setiap kali selesai membuat, memperbaiki, atau memodifikasi fitur/kode dan verifikasi (`build` / `type-check`) telah sukses, SELALU lakukan commit dan push perubahan ke GitHub (`git add .`, `git commit -m "..."`, `git push origin main`).
- **INTEGRITY**: Pastikan pesan commit jelas dan deskriptif sesuai perubahan yang dilakukan.

