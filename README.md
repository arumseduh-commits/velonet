# Velocity WhatsApp Registration Bot & Admin Management System (VeloNet)

VeloNet adalah sistem otomatisasi pendataan ulang & pendaftaran anggota komunitas Bahasa Inggris **Velocity** berbasis WhatsApp Bot dan Web Admin Dashboard modern.

---

## 🚀 Key Features & Architecture

1. **Next.js 16 (App Router)** & **TypeScript**: Performa tinggi dengan struktur folder modular.
2. **WhatsApp Session Persistence (Anti Scan QR Ulang)**:
   - Sesi autentikasi WhatsApp (`auth_info` Baileys) disimpan secara otomatis ke dalam **PostgreSQL Database** via model `BaileysAuth`.
   - Bot dapat di-redeploy atau di-restart kapan saja tanpa takut ter-logout atau harus melakukan scan QR ulang.
3. **Bot Engine State Machine**:
   - `WAITING_CONFIRMATION` $\rightarrow$ Konfirmasi awal (YA / TIDAK).
   - `OPTED_OUT` $\rightarrow$ Anggota memilih TIDAK (masuk ke **Kick List** admin).
   - Percabangan Formulir: Nama $\rightarrow$ Kelas $\rightarrow$ Motivasi $\rightarrow$ Hobi $\rightarrow$ `COMPLETED`.
4. **Auto-Reminder Cron Job**:
   - Memindai peserta dengan status `WAITING_CONFIRMATION` / `NOT_STARTED` (yang tidak di-exclude) untuk pengiriman ulang pesan konfirmasi otomatis.
5. **Real-time Admin Dashboard & Monitoring**:
   - Status Bot & Real-time Log Streaming via **Server-Sent Events (SSE)**.
   - Tabel Peserta interaktif (Filter status, Cari Nama/Nomor HP, Tambah Manual, Detail Modal).
   - Export Data ke **CSV & Excel**.
   - Manajemen **Kick List** & **Exclusion List** (Nomor pembina/admin yang dikecualikan dari bot).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2.12 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Glassmorphism Design System
- **Database & ORM**: PostgreSQL & Prisma ORM
- **WhatsApp Integration**: `@whiskeysockets/baileys` dengan custom Prisma Auth Store (`src/lib/baileys-db-auth.ts`)
- **Data Export**: `xlsx` (Excel & CSV)

---

## 📋 Environment Variables (.env.local)

Buat file `.env.local` di root proyek:

```env
# PostgreSQL Database Connection URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/velonet?schema=public"

# Admin Dashboard Password (Opsional)
ADMIN_PASSWORD="velonetadmin"

# Cooldown Pengingat Otomatis (dalam jam)
REMINDER_INTERVAL_MINUTES="1440"
```

---

## 💻 Panduan Jalankan Secara Lokal

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database PostgreSQL & Migration
Pastikan PostgreSQL sudah berjalan, lalu jalankan:
```bash
npx prisma db push
```

### 3. Jalankan Dev Server
```bash
npm run dev
```
Buka browser di:
- **Public Landing Page**: `http://localhost:3000`
- **Admin Dashboard**: `http://localhost:3000/admin`
- **Bot Control Center**: `http://localhost:3000/admin/bot`

---

## 🌐 Panduan Deploy Production

Karena WhatsApp Bot membutuhkan koneksi TCP/WebSocket yang terus aktif (*long-running process*), deploy paling disarankan dilakukan di platform berarsitektur long-running server seperti **VPS**, **Railway**, atau **Render**.

### A. Deploy di VPS (Ubuntu / Debian dengan PM2)

1. Clone repositori ke server VPS Anda.
2. Setup file `.env.local` dengan `DATABASE_URL` PostgreSQL VPS / Supabase / Neon.
3. Jalankan database migration:
   ```bash
   npx prisma db push
   ```
4. Build aplikasi Next.js:
   ```bash
   npm run build
   ```
5. Jalankan aplikasi menggunakan PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "velonet-app" -- start
   pm2 save
   ```

### B. Deploy di Railway / Render

1. Hubungkan repositori GitHub Anda ke **Railway** atau **Render**.
2. Buat PostgreSQL Database service di Railway/Render dan pasang `DATABASE_URL` ke Environment Variables.
3. Set **Build Command**: `npx prisma db push && npm run build`
4. Set **Start Command**: `npm run start`

---

## 🔐 Cara Kerjanya Sesi Permanen (Baileys DB Auth)

Sesi login WhatsApp disimpan ke tabel `BaileysAuth` menggunakan format JSON yang diserialisasi via `BufferJSON` (`src/lib/baileys-db-auth.ts`). 

1. Saat server bot dimulai, bot membaca kredensial `creds` dari tabel `BaileysAuth`.
2. Jika kredensial ditemukan, WhatsApp socket langsung terhubung tanpa membuat QR Code baru.
3. Jika admin mengklik **Logout Session** di dashboard, data pada tabel `BaileysAuth` dihapus dan bot kembali ke kondisi siap scan QR.
