import { DEFAULT_PREFERENCES, SKILL_CODES, type Material, type Preferences, type SkillCode } from "@langkahbelajar/shared";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { z } from "zod";
import { SKILL_LABELS, SKILL_HINTS, errorMessage } from "./copy";
import { NO_VOICE_EVENT, speak, useSpeechSource } from "./speech";
import { Icon, SKILL_ICONS } from "./ui/Icon";
import { Pipit } from "./ui/Pipit";
import { Engklek } from "./ui/Engklek";

export function Field({ label, error, hint, ...input }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...input} />
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function PasswordField({ label, error, hint, ...input }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <div className="input-action">
        <input id={id} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...input} />
        <button type="button" aria-pressed={visible} aria-label={visible ? "Sembunyikan sandi" : "Tampilkan sandi"} onClick={() => setVisible(!visible)}>
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function TextArea({ label, hint, value, onChange, maxLength }: { label: string; hint?: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <textarea id={id} rows={3} value={value} maxLength={maxLength} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export const Notice = ({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: ReactNode }) => (
  <div className={`notice notice-${tone}`} role={tone === "warn" ? "alert" : "status"}>{children}</div>
);

export const ErrorNotice = ({ error }: { error: unknown }) => (error ? <Notice tone="warn">{errorMessage(error)}</Notice> : null);

export const Loading = ({ label = "Memuat…" }: { label?: string }) => (
  <p className="loading" role="status"><Pipit className="pipit-small" /> {label}</p>
);

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} onClose={onClose} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      <div className="sheet-body">
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Tutup" onClick={onClose}><Icon name="close" /></button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

export function SkillPicker({ value, onChange, legend, error }: { value: SkillCode[]; onChange: (value: SkillCode[]) => void; legend: string; error?: string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="skill-grid">
        {SKILL_CODES.map((code) => (
          <label key={code} className="skill-card">
            <input type="checkbox" checked={value.includes(code)} onChange={(event) => onChange(event.target.checked ? [...value, code] : value.filter((item) => item !== code))} />
            <span className="skill-card-icon"><Icon name={SKILL_ICONS[code]} size={26} /></span>
            <span className="skill-card-text"><strong>{SKILL_LABELS[code]}</strong><small>{SKILL_HINTS[code]}</small></span>
            <span className="skill-card-check"><Icon name="check" size={16} /></span>
          </label>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}

const TEXT_SIZES: { value: Preferences["textSize"]; label: string; scale: string }[] = [
  { value: "NORMAL", label: "Biasa", scale: "1rem" },
  { value: "LARGE", label: "Besar", scale: "1.3rem" },
  { value: "XLARGE", label: "Sangat besar", scale: "1.6rem" },
];

export function PreferenceFields({ value, onChange }: { value: Preferences; onChange: (value: Preferences) => void }) {
  const name = useId();
  const toggle = (key: "audioEnabled" | "visualCues" | "reduceMotion", label: string, description: string) => (
    <label className="toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" role="switch" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />
    </label>
  );
  return (
    <div className="pref-fields">
      <fieldset>
        <legend>Ukuran teks</legend>
        <div className="segmented">
          {TEXT_SIZES.map((size) => (
            <label key={size.value}>
              <input type="radio" name={`${name}-size`} checked={value.textSize === size.value} onChange={() => onChange({ ...value, textSize: size.value })} />
              <span><b style={{ fontSize: size.scale }} aria-hidden="true">Aa</b>{size.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="toggles">
        {toggle("audioEnabled", "Tombol suara", "Anak bisa mendengar instruksi")}
        {toggle("visualCues", "Petunjuk gambar", "Tambahkan gambar pada instruksi")}
        {toggle("reduceMotion", "Tampilan tenang", "Tanpa gerakan dan hiasan")}
      </div>
      {value.audioEnabled && <VoiceStatus />}
      <fieldset>
        <legend>Cara menjawab</legend>
        <div className="segmented segmented-wide">
          <label>
            <input type="radio" name={`${name}-response`} checked={value.responseMethod === "TAP"} onChange={() => onChange({ ...value, responseMethod: "TAP" })} />
            <span>Anak menyentuh sendiri</span>
          </label>
          <label>
            <input type="radio" name={`${name}-response`} checked={value.responseMethod === "CAREGIVER_ASSISTED"} onChange={() => onChange({ ...value, responseMethod: "CAREGIVER_ASSISTED" })} />
            <span>Anak menunjuk, pendamping menekan</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

function VoiceStatus() {
  const source = useSpeechSource();
  return source ? (
    <p className="hint voice-status"><Icon name="speaker" size={18} /> Suara: {source}</p>
  ) : (
    <Notice tone="warn">Audio bahasa Indonesia belum tersedia. Anak tetap bisa belajar tanpa suara.</Notice>
  );
}

export function VoiceNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(NO_VOICE_EVENT, show);
    return () => window.removeEventListener(NO_VOICE_EVENT, show);
  }, []);
  if (!visible) return null;
  return (
    <div className="voice-notice" role="alert">
      <Icon name="speaker" />
      <p>Audio bahasa Indonesia untuk bagian ini belum tersedia. Anak tetap bisa lanjut belajar.</p>
      <button type="button" className="icon-button" aria-label="Tutup pesan suara" onClick={() => setVisible(false)}><Icon name="close" /></button>
    </div>
  );
}

/** A working sample of the real practice card, rendered with the preferences being edited. */
export function LivePreview({ preferences }: { preferences: Preferences }) {
  const [answered, setAnswered] = useState(false);
  const tiles = ["Mulai", "Latihan", "Selesai"].map((label, index) => ({
    key: label,
    label,
    state: index < (answered ? 2 : 1) ? ("done" as const) : index === (answered ? 2 : 1) ? ("current" as const) : ("todo" as const),
  }));
  return (
    <aside className="preview" aria-label="Pratinjau tampilan anak">
      <p className="preview-title">Tampilan untuk anak</p>
      <div className="preview-screen play-scale" data-text={preferences.textSize} data-motion={preferences.reduceMotion ? "off" : "on"}>
        <Engklek size="sm" label="Contoh langkah" tiles={tiles} />
        <div className="task-head">
          {preferences.audioEnabled && (
            <button type="button" className="sound-button" aria-label="Dengar contoh instruksi" onClick={() => speak("Pilih huruf A")}><Icon name="speaker" size={26} /></button>
          )}
          <p className="task-title">Pilih huruf A</p>
        </div>
        {preferences.visualCues && <p className="task-visual" role="img" aria-label="Gambar apel untuk huruf A">🍎</p>}
        <div className="choices">
          {["B", "A", "M"].map((option) => (
            <button key={option} type="button" className="choice" aria-pressed={answered && option === "A"} onClick={() => setAnswered(option === "A")}>{option}</button>
          ))}
        </div>
        {preferences.responseMethod === "CAREGIVER_ASSISTED" && <p className="hint">Anak menunjuk, pendamping menekan.</p>}
      </div>
      <p className="hint">Coba sentuh huruf A.</p>
    </aside>
  );
}

export const initialPreferences = (): Preferences => ({ ...DEFAULT_PREFERENCES });

export function MaterialView({ material }: { material: Material }) {
  const text = material.mediaUrl.startsWith("data:text/plain") ? decodeURIComponent(material.mediaUrl.slice(material.mediaUrl.indexOf(",") + 1)) : null;
  return (
    <div className="material">
      {material.format === "VISUAL" && <img src={material.mediaUrl} alt={material.title} loading="lazy" />}
      {material.format !== "VISUAL" && text && <p>{text}</p>}
      {material.format === "AUDIO" && text && (
        <button type="button" className="button quiet" onClick={() => speak(text)}><Icon name="speaker" size={20} /> Dengarkan</button>
      )}
      {material.format === "AUDIO" && !text && <audio controls src={material.mediaUrl} aria-label={material.title} />}
      {material.format === "TEXT" && !text && <a href={material.mediaUrl} rel="noreferrer" target="_blank">Buka materi</a>}
    </div>
  );
}

export function validate<S extends z.ZodType>(schema: S, value: unknown): { data?: z.output<S>; errors: Record<string, string> } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { data: parsed.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= FIELD_MESSAGES[String(issue.path[0])] ?? "Periksa isian ini.";
  return { errors };
}

const FIELD_MESSAGES: Record<string, string> = {
  email: "Masukkan alamat email yang valid.",
  password: "Kata sandi minimal 10 karakter.",
  newPassword: "Kata sandi baru minimal 10 karakter.",
  currentPassword: "Masukkan kata sandi saat ini.",
  displayName: "Masukkan nama Anda.",
  nickname: "Masukkan nama panggilan, maksimal 30 karakter.",
  targets: "Pilih minimal satu kemampuan.",
  body: "Tulis catatan terlebih dahulu.",
  days: "Pilih minimal satu hari.",
  time: "Masukkan waktu yang valid.",
  breakMinutes: "Lama istirahat 1 sampai 10 menit.",
};
