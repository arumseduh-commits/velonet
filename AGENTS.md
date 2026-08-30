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

# Runtime Uploads & Media Serving Standard (ATURAN SERVING MEDIA DINAMIS)
- **MANDATORY**: Jangan mengandalkan file statis default `public/` Next.js untuk berkas yang diunggah saat aplikasi berjalan (runtime). Selalu sediakan Route Handler (`src/app/uploads/.../route.ts`) untuk streaming berkas dari filesystem dengan MIME type dan header caching yang valid.

# CBT Anti-Cheat & Proctoring Standard (ATURAN CBT EXAMBRO & MOBILE PROCTORING)
- **MOBILE PRIORITY**: Anti-kecurangan CBT difokuskan pada event `visibilitychange`, `pagehide`, dan `fullscreenchange`. Fitur webcam proctoring harus selalu berstatus **non-aktif secara default** (`@default(false)`) untuk mencegah gangguan floating video dan deteksi wajah palsu di smartphone.

# Database Indexing & Query Optimization Standard (ATURAN MUTLAK PERFORMA QUERY & INDEXING VELONET)
- **MANDATORY INDEXING**: Setiap kolom relasi foreign key dan kolom yang sering digunakan untuk filter atau pengurutan data (`status`, `role`, `updatedAt`, `quizId`, `sessionId`, `courseId`, `userId`, dll.) pada `prisma/schema.prisma` WAJIB memiliki definisi `@@index` atau indeks komposit.
- **PAYLOAD DIET**: Pada endpoint daftar data (tabel/list), DILARANG memuat kolom blob/base64 berukuran besar (seperti `facePhoto` atau konten berkas) secara default. Selalu gunakan `select` pada Prisma Client untuk hanya mengirimkan field metadata yang dibutuhkan antarmuka pengguna.
- **BATCHING & ATOMIC TRANSACTIONS**: Dilarang menjalankan query database satu per satu di dalam perulangan sequential (*N+1 problem*). Gunakan operator `in` pada `findMany` atau jalankan `Promise.all` di dalam `prisma.$transaction` untuk operasi multi-baris.
- **NON-BLOCKING GET REQUESTS**: Handler HTTP GET yang di-polling secara berkala tidak boleh menjalankan operasi blocking I/O jaringan eksternal (seperti resolusi socket Baileys) atau database mutating writes di dalam critical request path.

# Universal Responsive Pagination Standard (ATURAN MUTLAK PAGINATION TABEL DATA VELONET)
- **MANDATORY PAGINATION COMPONENT**: Setiap tampilan tabel data atau daftar kartu dengan volume data dinamis WAJIB menggunakan komponen `<Pagination />` dari `@/components/ui/Pagination`.
- **SERVER-SIDE TRANSACTION PATTERN**: Endpoint API tabel wajib mendukung parameter `page` dan `limit` (default: 10, opsi: 10, 25, 50, 100, "ALL"), serta mengeksekusi `prisma.$transaction([countQuery, findManyQuery])` untuk efisiensi round-trip database.
- **SMART ELLIPSIS & MOBILE-FIRST**: Navigasi halaman wajib mendukung pemotongan nomor halaman pintar (`1 ... 4 5 6 ... 10`) dan layout responsif yang adaptif terhadap perangkat seluler.


