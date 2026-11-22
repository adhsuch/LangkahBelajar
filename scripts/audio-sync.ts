// Lists every spoken text, then links the audio files found in apps/web/public/audio/id into the app.
import { normalizeSpeech } from "../packages/shared/src/index";
import { activities, materials } from "../apps/provider-sim/src/data";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const AUDIO_DIR = "apps/web/public/audio/id";
const EXTENSIONS = [".mp3", ".m4a", ".wav"];
const LETTER_NAMES: Record<string, string> = { A: "a", B: "be", C: "ce", D: "de", E: "e", F: "ef", G: "ge", H: "ha", I: "i", J: "je", K: "ka", L: "el", M: "em", N: "en", O: "o", P: "pe", Q: "ki", R: "er", S: "es", T: "te", U: "u", V: "ve", W: "we", X: "eks", Y: "ye", Z: "zet" };

const graphemes = (text: string) => [...new Intl.Segmenter("id", { granularity: "grapheme" }).segment(text)].map((part) => part.segment).filter((part) => part.trim());
const isTextual = (text: string) => /[\p{L}\p{N}]/u.test(text);

function spokenTexts() {
  const texts = new Set<string>(["Pilih huruf A"]);
  let maxCount = 0;
  for (const activity of activities) {
    texts.add(activity.steps.map((step) => step.instruction).join(" "));
    if (activity.answer_rule.type === "exact") {
      for (const option of activity.steps.flatMap((step) => step.options ?? [])) if (isTextual(option)) texts.add(option);
    }
    if (activity.skill_code === "COUNTING") {
      const objects = graphemes(activity.steps[0]?.visual ?? "").filter((part) => part !== "+" && !isTextual(part));
      maxCount = Math.max(maxCount, objects.length);
    }
  }
  for (let count = 1; count <= maxCount; count += 1) texts.add(String(count));
  for (const material of materials) {
    if (material.format === "AUDIO") texts.add(decodeURIComponent(material.media_url.slice(material.media_url.indexOf(",") + 1)));
  }
  return [...new Set([...texts].map(normalizeSpeech))].sort((a, b) => a.localeCompare(b, "id"));
}

/** How the clip should sound: letter names, lowercase words, and spoken math. */
function readAs(text: string) {
  return text
    .replace(/\s*=\s*$/, " sama dengan berapa")
    .replace(/\s\+\s/g, " tambah ")
    .replace(/\s-\s/g, " kurang ")
    .replace(/\b[A-Z]\b/g, (letter) => LETTER_NAMES[letter] ?? letter)
    .replace(/\b[A-Z]{2,}\b/g, (word) => word.toLowerCase());
}

function baseName(text: string) {
  const slug = text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug || "clip"}-${createHash("sha1").update(text).digest("hex").slice(0, 6)}`;
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

mkdirSync(AUDIO_DIR, { recursive: true });
const texts = spokenTexts();
const clips: Record<string, string> = {};
const rows = ["file,text,read_as,status"];
for (const text of texts) {
  const base = baseName(text);
  const extension = EXTENSIONS.find((candidate) => existsSync(join(AUDIO_DIR, base + candidate)));
  if (extension) {
    const version = createHash("sha1").update(readFileSync(join(AUDIO_DIR, base + extension))).digest("hex").slice(0, 8);
    clips[text] = `/audio/id/${base}${extension}?v=${version}`;
  }
  rows.push([`${base}.mp3`, text, readAs(text), extension ? "ready" : "missing"].map(csvCell).join(","));
}
writeFileSync(join(AUDIO_DIR, "manifest.json"), `${JSON.stringify({ total: texts.length, clips }, null, 2)}\n`);
const CRLF = String.fromCharCode(13, 10);
// The byte order mark lets Excel open the Indonesian text as UTF-8.
writeFileSync("docs/AUDIO_SCRIPT.csv", String.fromCharCode(0xfeff) + rows.join(CRLF) + CRLF);
const characters = texts.reduce((sum, text) => sum + readAs(text).length, 0);
console.log(`${Object.keys(clips).length} of ${texts.length} clips ready, ${characters} characters to voice in total.`);
