import { noteCreateSchema, type SkillCode } from "@langkahbelajar/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, useLoad, type HistoryItem, type Note, type SkillProgress, type Summary } from "../api";
import { useChild } from "../App";
import { ErrorNotice, Loading, Notice, TextArea, validate } from "../components";
import { SKILL_LABELS, STAGE_LABELS, SUPPORT_LABELS } from "../copy";
import { Icon, SKILL_ICONS } from "../ui/Icon";
import { Engklek } from "../ui/Engklek";
import { ReviewCard, stageTiles } from "./home";

const formatDate = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

function insight(nickname: string, skills: SkillProgress[]) {
  const offered = skills.filter((skill) => skill.status === "NEXT_STAGE_OFFERED");
  if (offered.length > 0) return `${offered.map((skill) => SKILL_LABELS[skill.skillCode]).join(" dan ")} siap ditinjau untuk tahap berikutnya.`;
  const growing = skills.filter((skill) => skill.independentSessions > 0 && skill.status === "PRACTICING");
  if (growing.length > 0) return `${nickname} mulai mandiri di ${growing.map((skill) => SKILL_LABELS[skill.skillCode]).join(" dan ")}.`;
  if (skills.some((skill) => skill.status === "FINAL_STAGE_REACHED")) return `${nickname} sudah mencapai tahap terakhir yang tersedia di beberapa latihan.`;
  return `Selesaikan satu sesi untuk melihat perjalanan ${nickname}.`;
}

export function ProgressPage() {
  const { child } = useChild();
  const progress = useLoad(() => api<{ progress: SkillProgress[] }>(`/children/${child.id}/progress`), [child.id]);
  const summaries = useLoad(() => api<{ summaries: Summary[] }>(`/children/${child.id}/summaries`), [child.id]);
  const [open, setOpen] = useState<SkillCode | null>(null);
  const skills = progress.data?.progress ?? [];

  return (
    <div className="stack-lg">
      <header>
        <h1>Progres {child.nickname}</h1>
        {progress.data && <p className="insight">{insight(child.nickname, skills)}</p>}
        <p className="fine">Setiap kemampuan dicatat terpisah. Ini catatan pendampingan, bukan diagnosis.</p>
      </header>
      <ErrorNotice error={progress.error} />
      {progress.loading && !progress.data && <Loading />}
      <ul className="skill-list">
        {skills.map((skill) => (
          <li key={skill.skillCode} className="panel skill">
            <div className="skill-head">
              <span className="decision-icon"><Icon name={SKILL_ICONS[skill.skillCode]} /></span>
              <div>
                <h2>{SKILL_LABELS[skill.skillCode]}</h2>
                <p className="muted">Tahap {skill.currentLevel} dari {skill.maxLevel}: {STAGE_LABELS[skill.skillCode][skill.currentLevel - 1]}</p>
              </div>
            </div>
            <Engklek size="md" label={`Tahap ${SKILL_LABELS[skill.skillCode]}`} tiles={stageTiles(skill)} />
            <div className="evidence">
              <span className="evidence-dots" aria-hidden="true">
                {Array.from({ length: skill.threshold }, (_, index) => <i key={index} className={index < skill.independentSessions ? "on" : ""} />)}
              </span>
              <span>{Math.min(skill.independentSessions, skill.threshold)} dari {skill.threshold} sesi berhasil tanpa petunjuk atau contoh</span>
            </div>
            {skill.status === "NEXT_STAGE_OFFERED" && <ReviewCard skill={skill} childId={child.id} onReviewed={(updated) => progress.setData({ progress: updated })} />}
            {skill.status === "FINAL_STAGE_REACHED" && <Notice tone="good">Tahap terakhir yang tersedia sudah dicapai.</Notice>}
            <button className="text-button" aria-expanded={open === skill.skillCode} onClick={() => setOpen(open === skill.skillCode ? null : skill.skillCode)}>
              {open === skill.skillCode ? "Tutup riwayat" : "Lihat riwayat dan catatan"}
            </button>
            {open === skill.skillCode && <SkillDetail childId={child.id} skillCode={skill.skillCode} />}
          </li>
        ))}
      </ul>
      <section>
        <h2>Ringkasan sesi</h2>
        <ErrorNotice error={summaries.error} />
        {summaries.data?.summaries.length === 0 && (
          <div className="empty">
            <p>Ringkasan muncul setelah sesi pertama selesai.</p>
            <Link className="button quiet" to={`/children/${child.id}`}>Ke Hari ini</Link>
          </div>
        )}
        <ul className="summary-list">
          {summaries.data?.summaries.map((summary) => (
            <li key={summary.sessionId} className="panel">
              <strong>{formatDate(summary.completedAt)}</strong>
              <ul>
                {summary.skills.map((skill) => (
                  <li key={skill.skillCode}>
                    <Icon name={SKILL_ICONS[skill.skillCode]} size={18} /> {SKILL_LABELS[skill.skillCode]}: {skill.completed} selesai, {skill.independent} mandiri, {skill.withTaskHelp} dengan bantuan, {skill.skipped} dilewati{skill.postponed ? `, ${skill.postponed} ditunda` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SkillDetail({ childId, skillCode }: { childId: string; skillCode: SkillCode }) {
  const detail = useLoad(() => api<{ history: HistoryItem[] }>(`/children/${childId}/progress/${skillCode}`), [childId, skillCode]);
  const notes = useLoad(() => api<{ notes: Note[] }>(`/children/${childId}/notes?skill=${skillCode}`), [childId, skillCode]);
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<unknown>(null);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    const result = validate(noteCreateSchema, { body, skillCode });
    setFieldError(result.errors.body);
    if (!result.data) return;
    setError(null);
    try {
      await api(`/children/${childId}/notes`, { method: "POST", body: result.data });
      setBody("");
      void notes.reload();
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <div className="detail reveal">
      <ErrorNotice error={detail.error} />
      {detail.loading && !detail.data && <Loading />}
      {detail.data?.history.length === 0 && <p>Belum ada jawaban untuk kemampuan ini.</p>}
      <ul className="history">
        {detail.data?.history.map((item) => (
          <li key={item.id}>
            <span className={`history-mark ${item.independent ? "good" : ""}`} aria-hidden="true"><Icon name={item.isCorrect ? "check" : "retry"} size={16} /></span>
            <div>
              <strong>{item.title}</strong> <span className="muted">{formatDate(item.createdAt)}</span>
              <br />
              {item.independent ? "Berhasil mandiri" : item.isCorrect ? "Berhasil" : "Masih berlatih"}
              {item.supportUsed.length > 0 && `, memakai ${item.supportUsed.map((support) => SUPPORT_LABELS[support]).join(", ")}`}
              {!item.countsTowardMastery && ", aktivitas awal"}
            </div>
          </li>
        ))}
      </ul>
      <h3>Catatan pendamping</h3>
      <ul className="history">
        {notes.data?.notes.map((note) => <li key={note.id}><div>{note.body} <span className="muted">{note.authorName}, {formatDate(note.createdAt)}</span></div></li>)}
      </ul>
      <form onSubmit={addNote} noValidate>
        <ErrorNotice error={error} />
        <TextArea label="Tambah catatan" hint="Tulis yang Anda amati, tanpa diagnosis." value={body} maxLength={1000} onChange={setBody} />
        {fieldError && <p className="field-error">{fieldError}</p>}
        <button className="button quiet">Simpan catatan</button>
      </form>
    </div>
  );
}
