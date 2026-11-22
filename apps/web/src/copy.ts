import type { SkillCode, Support } from "@langkahbelajar/shared";
import { ApiError } from "./api";

// All user-facing Indonesian text that is shared between screens lives here.
export const SKILL_LABELS: Record<SkillCode, string> = {
  READING: "Membaca",
  WRITING: "Menulis",
  COUNTING: "Berhitung",
  INSTRUCTIONS: "Mengikuti instruksi",
  ENGAGEMENT: "Keterlibatan",
  ROUTINE: "Rutinitas",
};

export const SKILL_HINTS: Record<SkillCode, string> = {
  READING: "Huruf, suku kata, kata",
  WRITING: "Menelusuri dan menyalin",
  COUNTING: "Jumlah dan angka",
  INSTRUCTIONS: "Satu langkah, lalu rangkaian",
  ENGAGEMENT: "Fokus pada satu tugas",
  ROUTINE: "Urutan belajar",
};

export const STAGE_LABELS: Record<SkillCode, string[]> = {
  READING: ["Huruf", "Suku kata", "Kata sederhana"],
  WRITING: ["Menelusuri huruf", "Menyalin di kertas"],
  COUNTING: ["Mengenal jumlah", "Mencocokkan angka", "Operasi sederhana"],
  INSTRUCTIONS: ["Satu langkah", "Rangkaian pendek"],
  ENGAGEMENT: ["Satu tugas"],
  ROUTINE: ["Urutan belajar"],
};

export const SUPPORT_LABELS: Record<Support, string> = {
  HINT: "petunjuk",
  WORKED_EXAMPLE: "contoh",
  AUDIO: "audio",
  REPEAT_INSTRUCTION: "ulang instruksi",
  VISUAL_CUE: "petunjuk visual",
};

export const REASON_LABELS: Record<string, string> = {
  REPEAT_NEEDS_SUPPORT: "Diulang karena sebelumnya masih memakai bantuan.",
  NEW_ACTIVITY: "Kegiatan baru di tahap ini.",
  REINFORCE: "Latihan pemantapan.",
  STARTER: "Aktivitas awal, bukan tes.",
};

export const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const ERROR_MESSAGES: Record<string, string> = {
  NETWORK: "Koneksi terputus. Periksa jaringan, lalu coba lagi. Data yang sudah tersimpan tetap aman.",
  INVALID_CREDENTIALS: "Email atau kata sandi belum cocok. Periksa lagi, lalu coba masuk.",
  EMAIL_TAKEN: "Email ini sudah terdaftar. Masuk dengan email tersebut.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.",
  UNAUTHENTICATED: "Sesi masuk sudah berakhir. Silakan masuk lagi.",
  NOT_FOUND: "Data tidak ditemukan atau Anda belum memiliki akses.",
  VALIDATION_ERROR: "Beberapa isian perlu diperbaiki.",
  SESSION_ALREADY_ACTIVE: "Masih ada sesi yang belum selesai. Lanjutkan sesi itu dulu.",
  ACTIVITIES_UNAVAILABLE: "Aktivitas belum bisa dimuat. Progres tetap aman. Coba lagi nanti.",
  SESSION_NOT_ACTIVE: "Sesi sedang tidak berjalan. Lanjutkan sesi dulu.",
  STEP_NOT_CURRENT: "Langkah ini sudah berganti. Halaman akan menampilkan langkah terbaru.",
  IDEMPOTENCY_CONFLICT: "Jawaban ini sudah tercatat. Lanjutkan ke langkah berikutnya.",
  OWNER_REQUIRED: "Hanya pemilik profil yang dapat membagikan akses.",
  ALREADY_SHARED: "Pendamping ini sudah memiliki akses.",
  INVALID_CURRENT_PASSWORD: "Kata sandi saat ini belum cocok.",
  NO_PENDING_RECOMMENDATION: "Belum ada rekomendasi tahap untuk ditinjau.",
};

export function errorMessage(error: unknown) {
  const code = error instanceof ApiError ? error.code : "UNKNOWN";
  return ERROR_MESSAGES[code] ?? "Permintaan belum berhasil. Coba lagi sebentar lagi.";
}
