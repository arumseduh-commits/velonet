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
 * Generates varied messages for each registration step.
 * Prevents WhatsApp from detecting identical bot responses during registration.
 */
export function buildRegistrationMessage(
  step: "ask_name" | "ask_class" | "ask_motivation" | "ask_hobby" | "completed" | "opted_out" | "remind_confirm",
  name?: string,
  studentClass?: string,
  motivation?: string,
  hobby?: string
): string {
  switch (step) {
    case "ask_name": {
      const variants = [
        `Siap! Terima kasih sudah konfirmasi! 🎉\n\nYuk mulai isi data pendaftaran.\n*Pertanyaan 1 dari 4:*\nSiapa nama lengkap kamu?`,
        `Oke! Konfirmasi diterima 👍\n\nAyo isi data kamu sekarang!\n*Langkah 1/4:*\nNama lengkap kamu siapa?`,
        `Terima kasih atas konfirmasinya! 😊\n\nKita mulai pendaftaran ya.\n*Soal 1 dari 4:*\nCoba tulis nama lengkap kamu di sini!`,
        `Mantap! Selamat bergabung di Velocity! 🚀\n\nSilakan lengkapi data berikut.\n*Pertanyaan 1/4:*\nNama lengkap kamu?`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    case "ask_class": {
      const variants = [
        `Hai *${name}*! 😄\n\nSatu lagi nih!\n*Pertanyaan 2 dari 4:*\nKamu duduk di kelas berapa? _(Contoh: X IPA 1 / XI IPS 2)_`,
        `Sip, nama *${name}* sudah tercatat! ✅\n\n*Langkah 2/4:*\nKamu kelas berapa sekarang? _(misal: X MIPA 1)_`,
        `Oke *${name}*! Nama sudah masuk 👌\n\n*Soal 2 dari 4:*\nSekarang kelas berapa? _(contoh: XI IPS 2)_`,
        `Keren *${name}*! ✨\n\n*Pertanyaan 2/4:*\nKamu dari kelas apa? _(Format: X/XI/XII + jurusan + nomor kelas)_`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    case "ask_motivation": {
      const variants = [
        `Oke, data kelas sudah kami simpan! 📝\n\n*Pertanyaan 3 dari 4:*\nApa motivasi atau alasan kamu ingin belajar Bahasa Inggris di Velocity?`,
        `Kelas sudah tercatat! 👍\n\n*Langkah 3/4:*\nCeritain dong, kenapa kamu tertarik belajar Bahasa Inggris? 🤔`,
        `Data kelas sudah masuk ✅\n\n*Soal 3 dari 4:*\nApa yang memotivasi kamu untuk bergabung di ekskul Bahasa Inggris ini?`,
        `Siap! Kelas sudah kami catat 📌\n\n*Pertanyaan 3/4:*\nKenapa kamu mau ikut ekskul Bahasa Inggris Velocity? Boleh dijawab jujur ya! 😊`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    case "ask_hobby": {
      const variants = [
        `Wah, motivasi yang bagus! 🌟\n\n*Pertanyaan 4 dari 4 (Terakhir!):*\nKalau hobi kamu apa? 🎯`,
        `Keren motivasinya! 💪\n\n*Langkah 4/4 — Terakhir!*\nHobi kamu apa nih? 😄`,
        `Oke, motivasi sudah tercatat! ✨\n\n*Soal terakhir (4 dari 4):*\nApa hobi atau kegiatan favorit kamu?`,
        `Bagus banget! 🙌\n\n*Pertanyaan 4/4 (Finishing!):*\nTerakhir, hobi kamu apa? Ceritain dong! 🎉`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    case "completed": {
      const intros = [
        `🎊 Yeay, pendaftaran kamu SELESAI!`,
        `🎉 Pendaftaran berhasil! Selamat bergabung di Velocity!`,
        `✅ Data kamu sudah tersimpan lengkap!`,
        `🚀 Kamu resmi terdaftar di Komunitas Velocity!`,
      ];
      const outros = [
        `\n\nSampai jumpa di kelas Velocity! Semangat belajar ya! 💪`,
        `\n\nSelamat datang di keluarga Velocity! 🏆`,
        `\n\nSampai ketemu di pertemuan pertama! 🌟`,
        `\n\nHave fun learning English bareng kami! 🎯`,
      ];
      return (
        `${pick(intros)}\n\n` +
        `*Rekap Data Pendaftaranmu:*\n` +
        `👤 Nama: ${name || "-"}\n` +
        `🏫 Kelas: ${studentClass || "-"}\n` +
        `💡 Motivasi: ${motivation || "-"}\n` +
        `🎯 Hobi: ${hobby || "-"}` +
        `${pick(outros)}${addInvisibleUniqueness()}`
      );
    }

    case "opted_out": {
      const variants = [
        `Baik, tidak masalah! Terima kasih sudah merespons ya 🙏\n\nJika sewaktu-waktu berubah pikiran, ketik *DAFTAR* untuk mendaftar ulang.`,
        `Oke, kami catat ya 😊 Terima kasih atas konfirmasinya!\n\nKalau nanti mau bergabung lagi, ketik *DAFTAR* kapan saja.`,
        `Tidak apa-apa! Keputusanmu kami hormati 🙏\n\nAnda bisa mendaftar kembali kapan saja dengan mengetik *DAFTAR*.`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    case "remind_confirm": {
      const variants = [
        `Halo! 👋 Sebelum lanjut, mohon konfirmasi dulu:\n\nApakah kamu masih ingin ikut ekskul Bahasa Inggris di Komunitas Velocity?\n\nBalas *YA* untuk daftar, atau *TIDAK* untuk keluar.`,
        `Hai! 😊 Kami butuh konfirmasimu dulu:\n\nMasih mau lanjut belajar Bahasa Inggris di Velocity?\n\nKetik *YA* jika iya, atau *TIDAK* jika tidak.`,
        `Permisi! 🙏 Sebelumnya konfirmasi dulu ya:\n\nApakah kamu berminat bergabung di ekskul Bahasa Inggris Velocity?\n\nBalas *YA* atau *TIDAK*.`,
      ];
      return pick(variants) + addInvisibleUniqueness();
    }

    default:
      return "Halo! Silakan konfirmasi keikutsertaan kamu." + addInvisibleUniqueness();
  }
}

/**
 * Generates a unique initial DM confirmation request for group members.
 * Used by sendConfirmationToMember in bot-engine.ts.
 */
export function buildConfirmationMessage(name?: string): string {
  const namePart = name ? ` Kak *${name}*` : "";

  const templates = [
    `Halo${namePart}! 👋\n\nKami ingin menanyakan apakah${namePart ? " Kakak" : " kamu"} masih berminat melanjutkan pelatihan ekskul Bahasa Inggris di Komunitas Velocity? 🚀\n\nBalas *YA* untuk lanjut, atau *TIDAK* untuk mundur.\n\n_Terima kasih atas responsnya!_ 🙏`,
    `Halo${namePart}! 😊\n\nKomunitas Velocity menghubungi${namePart ? " Kakak" : "mu"} untuk konfirmasi keikutsertaan ekskul Bahasa Inggris.\n\nMasih mau lanjut? Balas *YA* atau *TIDAK* ya!\n\n_Ditunggu konfirmasinya_ 🙂`,
    `Permisi${namePart}! 🙏\n\nApakah${namePart ? " Kakak" : " kamu"} masih ingin ikut program ekskul Bahasa Inggris Velocity?\n\nKetik *YA* jika masih berminat, atau *TIDAK* jika ingin keluar.\n\n_Terima kasih banyak!_ ✨`,
    `Hai${namePart}! 👋\n\nIni pesan dari bot Komunitas Velocity.\nKami ingin mengkonfirmasi apakah${namePart ? " Kakak" : " kamu"} masih aktif di program ekskul Bahasa Inggris kita.\n\nSilakan balas:\n✅ *YA* — Masih ikut!\n❌ *TIDAK* — Mundur\n\n_Salam hangat dari Velocity!_ 🚀`,
  ];

  return pick(templates) + addInvisibleUniqueness();
}
