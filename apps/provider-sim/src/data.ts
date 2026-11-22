// Simulated partner content that follows the proposed contract in the paper.
type Rule =
  | { type: "exact"; value: string }
  | { type: "ordered"; values: string[] }
  | { type: "completion" }
  | { type: "caregiver_confirmation" };

export interface ActivityDto {
  activity_id: string;
  version: number;
  skill_code: string;
  level: number;
  title: string;
  steps: { instruction: string; visual?: string; options?: string[]; target?: string }[];
  example?: string;
  hint?: string;
  answer_rule: Rule;
}

export interface MaterialDto {
  material_id: string;
  version: number;
  skill_code: string;
  level: number;
  format: "TEXT" | "VISUAL" | "AUDIO";
  media_url: string;
  title: string;
}

const choice = (id: string, skill: string, level: number, title: string, instruction: string, options: string[], value: string, example: string, hint: string, visual?: string): ActivityDto => ({
  activity_id: id, version: 1, skill_code: skill, level, title,
  steps: [{ instruction, options, ...(visual ? { visual } : {}) }],
  example, hint, answer_rule: { type: "exact", value },
});

const order = (id: string, skill: string, level: number, title: string, instruction: string, values: string[], options: string[], example: string, hint: string): ActivityDto => ({
  activity_id: id, version: 1, skill_code: skill, level, title,
  steps: [{ instruction, options }],
  example, hint, answer_rule: { type: "ordered", values },
});

const trace = (letter: string): ActivityDto => ({
  activity_id: `write-trace-${letter.toLowerCase()}`, version: 1, skill_code: "WRITING", level: 1, title: `Telusuri huruf ${letter}`,
  steps: [{ instruction: `Ikuti bentuk huruf ${letter} dengan jarimu.`, target: letter }],
  example: `Mulai dari atas, lalu ikuti garis huruf ${letter} pelan-pelan.`, hint: "Tidak perlu sempurna. Ikuti garisnya sebisamu.",
  answer_rule: { type: "completion" },
});

const paper = (word: string): ActivityDto => ({
  activity_id: `write-copy-${word.toLowerCase()}`, version: 1, skill_code: "WRITING", level: 2, title: `Salin kata ${word}`,
  steps: [{ instruction: `Tulis kata ${word} di kertas.`, target: word }, { instruction: "Tunjukkan tulisanmu kepada pendamping." }],
  example: `Lihat kata ${word}, lalu tulis satu huruf demi satu huruf.`, hint: "Boleh melihat contohnya sambil menulis.",
  answer_rule: { type: "caregiver_confirmation" },
});

const done = (id: string, skill: string, title: string, instructions: string[], example: string, hint: string): ActivityDto => ({
  activity_id: id, version: 1, skill_code: skill, level: 1, title,
  steps: instructions.map((instruction) => ({ instruction })),
  example, hint, answer_rule: { type: "completion" },
});

export const activities: ActivityDto[] = [
  choice("read-letter-a", "READING", 1, "Kenali huruf A", "Pilih huruf A.", ["B", "A", "M"], "A", "Huruf A punya dua garis miring dan satu garis tengah.", "Cari huruf yang bentuknya seperti atap rumah."),
  choice("read-letter-m", "READING", 1, "Kenali huruf M", "Pilih huruf M.", ["M", "N", "W"], "M", "Huruf M punya dua puncak di atas.", "Cari huruf dengan dua puncak."),
  choice("read-letter-s", "READING", 1, "Kenali huruf S", "Pilih huruf S.", ["Z", "C", "S"], "S", "Huruf S berkelok seperti ular.", "Cari huruf yang berkelok.", "🐍"),
  choice("read-syllable-ba", "READING", 2, "Suku kata BA", "Pilih suku kata BA.", ["BU", "BA", "DA"], "BA", "B dan A dibaca BA.", "Mulai dari huruf B, lalu cari huruf A."),
  choice("read-syllable-mi", "READING", 2, "Suku kata MI", "Pilih suku kata MI.", ["MI", "ME", "NI"], "MI", "M dan I dibaca MI.", "Mulai dari huruf M, lalu cari huruf I."),
  choice("read-syllable-ku", "READING", 2, "Suku kata KU", "Pilih suku kata KU.", ["KA", "GU", "KU"], "KU", "K dan U dibaca KU.", "Mulai dari huruf K, lalu cari huruf U."),
  choice("read-word-bola", "READING", 3, "Kata BOLA", "Pilih kata untuk gambar ini.", ["BOLA", "BOTA", "DOLA"], "BOLA", "BO dan LA dibaca BOLA.", "Kata ini dimulai dengan BO.", "⚽"),
  choice("read-word-ikan", "READING", 3, "Kata IKAN", "Pilih kata untuk gambar ini.", ["IKAN", "IPAN", "KAIN"], "IKAN", "I dan KAN dibaca IKAN.", "Kata ini dimulai dengan I.", "🐟"),
  choice("read-word-buku", "READING", 3, "Kata BUKU", "Pilih kata untuk gambar ini.", ["DUKU", "BUKU", "BAKU"], "BUKU", "BU dan KU dibaca BUKU.", "Kata ini dimulai dengan BU.", "📘"),
  trace("A"), trace("B"), trace("I"),
  paper("BOLA"), paper("IBU"), paper("BUKU"),
  choice("count-qty-3", "COUNTING", 1, "Hitung apel", "Ada berapa apel?", ["2", "3", "5"], "3", "Tunjuk satu per satu: satu, dua, tiga.", "Tunjuk tiap apel sambil menghitung.", "🍎🍎🍎"),
  choice("count-qty-4", "COUNTING", 1, "Hitung bintang", "Ada berapa bintang?", ["4", "6", "3"], "4", "Tunjuk satu per satu: satu, dua, tiga, empat.", "Tunjuk tiap bintang sambil menghitung.", "⭐⭐⭐⭐"),
  choice("count-qty-2", "COUNTING", 1, "Hitung bola", "Ada berapa bola?", ["1", "2", "4"], "2", "Tunjuk satu per satu: satu, dua.", "Tunjuk tiap bola sambil menghitung.", "⚽⚽"),
  choice("count-match-5", "COUNTING", 2, "Cocokkan angka 5", "Pilih gambar yang jumlahnya 5.", ["🐟🐟🐟", "🐟🐟🐟🐟🐟", "🐟🐟"], "🐟🐟🐟🐟🐟", "Angka 5 berarti ada lima benda.", "Hitung ikan di setiap pilihan."),
  choice("count-match-3", "COUNTING", 2, "Cocokkan angka 3", "Pilih gambar yang jumlahnya 3.", ["🌼🌼🌼", "🌼", "🌼🌼🌼🌼"], "🌼🌼🌼", "Angka 3 berarti ada tiga benda.", "Hitung bunga di setiap pilihan."),
  choice("count-op-add-2-1", "COUNTING", 3, "Penjumlahan", "2 + 1 = ?", ["2", "3", "4"], "3", "Punya 2 apel, tambah 1 apel, jadi 3 apel.", "Mulai dari 2, lalu hitung satu lagi.", "🍎🍎 + 🍎"),
  choice("count-op-add-3-2", "COUNTING", 3, "Penjumlahan", "3 + 2 = ?", ["5", "4", "6"], "5", "Punya 3 bintang, tambah 2 bintang, jadi 5 bintang.", "Mulai dari 3, lalu hitung dua lagi.", "⭐⭐⭐ + ⭐⭐"),
  choice("count-op-sub-3-1", "COUNTING", 3, "Pengurangan", "3 - 1 = ?", ["1", "2", "3"], "2", "Punya 3 bola, diambil 1, sisa 2 bola.", "Tutup satu bola, lalu hitung sisanya.", "⚽⚽⚽"),
  choice("instr-single-circle", "INSTRUCTIONS", 1, "Satu langkah", "Sentuh lingkaran.", ["🔺", "⚫", "🟦"], "⚫", "Lingkaran bentuknya bulat.", "Cari bentuk yang bulat.", "👆"),
  choice("instr-single-blue", "INSTRUCTIONS", 1, "Satu langkah", "Sentuh kotak biru.", ["🟥", "🟦", "🟨"], "🟦", "Warna biru seperti langit.", "Cari kotak berwarna seperti langit.", "👆"),
  order("instr-seq-wash", "INSTRUCTIONS", 2, "Urutan cuci tangan", "Sentuh sesuai urutan cuci tangan.", ["Basahi tangan", "Pakai sabun", "Bilas tangan"], ["Bilas tangan", "Basahi tangan", "Pakai sabun"], "Basahi dulu, lalu sabun, lalu bilas.", "Apa yang dilakukan paling awal?"),
  order("instr-seq-bag", "INSTRUCTIONS", 2, "Urutan siapkan tas", "Sentuh sesuai urutan menyiapkan tas.", ["Buka tas", "Masukkan buku", "Tutup tas"], ["Masukkan buku", "Tutup tas", "Buka tas"], "Buka tas, masukkan buku, lalu tutup.", "Apa yang harus dibuka lebih dulu?"),
  done("engage-focus-color", "ENGAGEMENT", "Cari warna", ["Cari satu benda berwarna merah di dekatmu.", "Tekan Selesai kalau sudah menemukannya."], "Misalnya tutup botol atau buku berwarna merah.", "Lihat pelan-pelan ke sekitarmu."),
  done("engage-focus-count", "ENGAGEMENT", "Tepuk tangan", ["Tepuk tangan tiga kali.", "Tekan Selesai kalau sudah."], "Tepuk, tepuk, tepuk.", "Boleh sambil menghitung."),
  order("routine-order-session", "ROUTINE", 1, "Urutan belajar", "Sentuh sesuai urutan belajar kita.", ["Mulai", "Latihan", "Istirahat", "Selesai"], ["Istirahat", "Mulai", "Selesai", "Latihan"], "Kita mulai, latihan, istirahat, lalu selesai.", "Apa yang kita lakukan pertama kali?"),
  done("routine-prepare", "ROUTINE", "Siapkan tempat", ["Duduk di tempat belajarmu.", "Siapkan pensil dan kertas.", "Tekan Selesai kalau sudah siap."], "Pensil dan kertas ada di depanmu.", "Pendamping boleh membantu."),
];

const SKILL_TITLES: Record<string, string[]> = {
  READING: ["Mengenal huruf", "Mengenal suku kata", "Membaca kata sederhana"],
  WRITING: ["Menelusuri huruf", "Menyalin di kertas"],
  COUNTING: ["Mengenal jumlah", "Mencocokkan angka", "Operasi sederhana"],
  INSTRUCTIONS: ["Satu langkah", "Rangkaian pendek"],
  ENGAGEMENT: ["Satu tugas"],
  ROUTINE: ["Urutan belajar"],
};
const SKILL_ICONS: Record<string, string> = { READING: "📖", WRITING: "✏️", COUNTING: "🔢", INSTRUCTIONS: "👆", ENGAGEMENT: "🌱", ROUTINE: "🗓️" };

const svgCard = (icon: string, title: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${title}"><rect width="320" height="180" rx="16" fill="#E6E8F8"/><text x="160" y="92" font-size="56" text-anchor="middle">${icon}</text><text x="160" y="145" font-size="20" font-family="sans-serif" text-anchor="middle" fill="#171B3D">${title}</text></svg>`,
  );
const textData = (text: string) => "data:text/plain;charset=utf-8," + encodeURIComponent(text);

export const materials: MaterialDto[] = Object.entries(SKILL_TITLES).flatMap(([skill, titles]) =>
  titles.flatMap((title, index) => {
    const level = index + 1;
    const id = `${skill.toLowerCase()}-l${level}`;
    const body = `Hari ini kita belajar ${title.toLowerCase()}. Pelan-pelan saja, boleh diulang kapan pun.`;
    const base = { version: 1, skill_code: skill, level, title };
    return [
      { ...base, material_id: `${id}-text`, format: "TEXT" as const, media_url: textData(body) },
      { ...base, material_id: `${id}-visual`, format: "VISUAL" as const, media_url: svgCard(SKILL_ICONS[skill] ?? "📘", title) },
      // shortcut: AUDIO is a script read by device text-to-speech, replace with recorded audio from a real provider.
      { ...base, material_id: `${id}-audio`, format: "AUDIO" as const, media_url: textData(body) },
    ];
  }),
);
