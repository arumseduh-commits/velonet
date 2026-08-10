/**
 * Message Variation Utility
 * Generates humanized, varied WhatsApp messages to avoid copy-paste spam detection.
 * Each participant receives a slightly different version of the message.
 */

// Random pick from array
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random invisible unicode zero-width characters (undetectable by WA spam filter, add uniqueness)
function zwsp(): string {
  const chars = ["\u200b", "\u200c", "\u200d", "\ufeff"];
  return pick(chars);
}

// Add subtle invisible character uniqueness at the end
function addInvisibleUniqueness(): string {
  const count = Math.floor(Math.random() * 3) + 1;
  return Array.from({ length: count }, () => zwsp()).join("");
}

// Varied greetings
const greetings = [
  (name: string) => `Halo Kak *${name}*! 👋`,
  (name: string) => `Hai Kak *${name}* 😊`,
  (name: string) => `Assalamu'alaikum Kak *${name}* 🙏`,
  (name: string) => `Selamat siang Kak *${name}*,`,
  (name: string) => `Halo halo Kak *${name}* 😄`,
  (name: string) => `Permisi Kak *${name}* 🙂,`,
];

// Varied closing lines
const closings = [
  "_Terima kasih atas perhatiannya! 🙏_",
  "_Ditunggu kehadirannya ya Kak! 🎉_",
  "_Semangat belajarnya Kak! 💪_",
  "_Jangan lupa hadir ya! 😊_",
  "_Terima kasih, sampai jumpa! 👋_",
  "_Salam dari tim Velocity! 🚀_",
];

// Varied separator lines
const separators = ["—", "~", "·", "•", "―"];

/**
 * Generates a unique broadcast message for a session announcement.
 */
export function buildSessionBroadcastMessage(params: {
  name: string;
  sessionTitle: string;
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  locationName: string;
  customMessage?: string;
  isCancellation?: boolean;
}): string {
  const { name, sessionTitle, dateStr, startTimeStr, endTimeStr, locationName, customMessage, isCancellation } = params;
  const greet = pick(greetings)(name || "Peserta");
  const closing = pick(closings);
  const sep = pick(separators);

  if (isCancellation) {
    const reasons = [
      "mohon maaf atas perubahan mendadak ini.",
      "kami memohon maklum atas ketidaknyamanan ini.",
      "terima kasih atas pengertiannya.",
    ];
    return (
      `🔴 *PEMBATALAN PERTEMUAN VELOCITY*\n\n` +
      `${greet}\n\n` +
      `Dengan berat hati kami sampaikan bahwa sesi *"${sessionTitle}"* ` +
      `yang dijadwalkan pada *${dateStr}* di *${locationName}* ` +
      `telah *DIBATALKAN* oleh Pembina.\n\n` +
      (customMessage ? `📝 *Catatan:*\n${customMessage}\n\n` : "") +
      `${pick(reasons)}\n\n${closing}${addInvisibleUniqueness()}`
    );
  }

  // Vary the instruction sentence slightly
  const instructions = [
    `Saat tiba di lokasi sebelum jam ${endTimeStr} WIB, kirimkan *Share Location* WhatsApp ke bot ini untuk absen otomatis.`,
    `Untuk absen, kirim *lokasi WhatsApp* Anda ke bot ini saat sudah berada di titik kumpul sebelum ${endTimeStr} WIB.`,
    `Absensi dilakukan dengan kirim *Share Location* ke bot ini. Pastikan sudah di lokasi sebelum ${endTimeStr} WIB ya Kak!`,
  ];

  const izinTexts = [
    `Jika berhalangan, balas: *!izin [alasan]*`,
    `Bila ada halangan, ketik: *!izin [alasan kamu]*`,
    `Kalau berhalangan hadir, tulis: *!izin [alasanmu]*`,
  ];

  return (
    `📢 *PENGUMUMAN PERTEMUAN VELOCITY*\n\n` +
    `${greet}\n\n` +
    `${sep} *${sessionTitle}*\n` +
    `📅 *Tanggal:* ${dateStr}\n` +
    `⏰ *Buka Absen:* ${startTimeStr} WIB\n` +
    `⌛ *Tutup Absen:* ${endTimeStr} WIB\n` +
    `📍 *Lokasi:* ${locationName}\n` +
    (customMessage ? `\n📝 *Catatan Admin:*\n${customMessage}\n` : "") +
    `\n${pick(instructions)}\n\n` +
    `_${pick(izinTexts)}_\n\n` +
    `${closing}${addInvisibleUniqueness()}`
  );
}

/**
 * Generates a unique follow-up ALPA message.
 */
export function buildAlpaFollowUpMessage(params: {
  name?: string;
  sessionTitle: string;
  dateStr: string;
  customNote?: string;
}): string {
  const { name, sessionTitle, dateStr, customNote } = params;
  const greet = pick(greetings)(name || "Peserta");
  const closing = pick(closings);

  const alpaPhrases = [
    `tercatat *tidak hadir (ALPA)*`,
    `belum terekam kehadirannya`,
    `tidak tercatat hadir`,
  ];

  const izinFormats = [
    `Format: *!izin [alasan]* — Contoh: \`!izin sakit\``,
    `Caranya: ketik *!izin [alasanmu]* — misal: \`!izin ada keperluan keluarga\``,
    `Tulis: *!izin [keterangan]* ke bot ini — contoh: \`!izin demam\``,
  ];

  return (
    `🔴 *PEMBERITAHUAN KEHADIRAN VELOCITY*\n\n` +
    `${greet}\n\n` +
    `Catatan kami menunjukkan bahwa Kakak ${pick(alpaPhrases)} pada sesi *"${sessionTitle}"* (${dateStr}).\n\n` +
    (customNote ? `📝 *Pesan Pembina:*\n${customNote}\n\n` : "") +
    `Untuk pertemuan berikutnya, jika berhalangan hadir mohon izin terlebih dahulu.\n` +
    `${pick(izinFormats)}\n\n` +
    `${closing}${addInvisibleUniqueness()}`
  );
}

/**
 * Generates a unique confirmation request message.
 */
export function buildConfirmationMessage(name?: string): string {
  const namePart = name ? ` Kak *${name}*` : "";

  const templates = [
    `Halo${namePart}! 👋\n\nKami ingin menanyakan apakah${namePart ? " Kakak" : " kamu"} masih berminat melanjutkan pelatihan ekskul Bahasa Inggris di Komunitas Velocity? 🚀\n\nBalas *YA* untuk lanjut, atau *TIDAK* untuk mundur.\n\n_Terima kasih atas responsnya!_ 🙏`,
    `Halo${namePart}! 😊\n\nKomunitas Velocity menghubungi${namePart ? " Kakak" : "mu"} untuk konfirmasi keikutsertaan ekskul Bahasa Inggris.\n\nMasih mau lanjut? Balas *YA* atau *TIDAK* ya Kak!\n\n_Ditunggu konfirmasinya_ 🙂`,
    `Permisi${namePart}! 🙏\n\nApakah${namePart ? " Kakak" : " kamu"} masih ingin ikut program ekskul Bahasa Inggris Velocity?\n\nKetik *YA* jika masih berminat, atau *TIDAK* jika ingin keluar.\n\n_Terima kasih banyak!_ ✨`,
    `Hai${namePart}! 👋\n\nIni pesan dari bot Komunitas Velocity.\nKami ingin mengkonfirmasi apakah${namePart ? " Kakak" : " kamu"} masih aktif di program ekskul Bahasa Inggris kita.\n\nSilakan balas:\n✅ *YA* — Masih ikut!\n❌ *TIDAK* — Mundur\n\n_Salam hangat dari Velocity!_ 🚀`,
  ];

  return pick(templates) + addInvisibleUniqueness();
}
