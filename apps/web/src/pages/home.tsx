import { SKILL_CODES, routineUpdateSchema, type SkillCode } from "@langkahbelajar/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api, useLoad, type LearningSession, type Routine, type SkillProgress, type Summary } from "../api";
import { useChild } from "../App";
import { ErrorNotice, Field, Loading, Sheet, SkillPicker, validate } from "../components";
import { DAY_LABELS, DAY_SHORT, SKILL_LABELS, STAGE_LABELS } from "../copy";
import { Icon, SKILL_ICONS } from "../ui/Icon";
import { Pipit } from "../ui/Pipit";
import { Engklek, type Tile } from "../ui/Engklek";

export function nextOccurrence(routine: Routine, now = new Date()) {
  const [hour = 0, minute = 0] = routine.time.split(":").map(Number);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (routine.days.includes(candidate.getDay()) && candidate > now) return { date: candidate, today: offset === 0 };
  }
  return null;
}

export const stageTiles = (skill: SkillProgress): Tile[] =>
  STAGE_LABELS[skill.skillCode].slice(0, skill.maxLevel).map((label, index) => {
    const level = index + 1;
    const finished = level < skill.currentLevel || (level === skill.currentLevel && skill.status === "FINAL_STAGE_REACHED");
    return { key: label, label, state: finished ? "done" : level === skill.currentLevel ? "current" : "todo" };
  });

export function ReviewCard({ skill, childId, onReviewed }: { skill: SkillProgress; childId: string; onReviewed: (progress: SkillProgress[]) => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function review(decision: "ADVANCE" | "KEEP_PRACTICING") {
    setBusy(true);
    setError(null);
    try {
      const { progress } = await api<{ progress: SkillProgress[] }>(`/children/${childId}/progress/${skill.skillCode}/review`, { method: "POST", body: { decision } });
      onReviewed(progress);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }
  return (
    <div className="decision">
      <span className="decision-icon"><Icon name={SKILL_ICONS[skill.skillCode]} /></span>
      <div>
        <h3>{SKILL_LABELS[skill.skillCode]}: siap ditinjau</h3>
        <p>Berhasil tanpa petunjuk di {skill.independentSessions} sesi berbeda pada tahap {STAGE_LABELS[skill.skillCode][skill.currentLevel - 1]}.</p>
        <ErrorNotice error={error} />
        <div className="row">
          <button className="button" disabled={busy} onClick={() => review("ADVANCE")}>Lanjut ke {STAGE_LABELS[skill.skillCode][skill.currentLevel]}</button>
          <button className="button quiet" disabled={busy} onClick={() => review("KEEP_PRACTICING")}>Tetap di tahap ini</button>
        </div>
      </div>
    </div>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];

function WeekRhythm({ routine, summaries }: { routine: Routine; summaries: Summary[] }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const practiced = new Set(summaries.filter((item) => new Date(item.completedAt) >= monday).map((item) => new Date(item.completedAt).getDay()));
  return (
    <ul className="week" aria-label="Jadwal minggu ini">
      {WEEK.map((day) => {
        const state = [practiced.has(day) ? "sudah belajar" : "", routine.days.includes(day) ? "terjadwal" : "libur", day === today.getDay() ? "hari ini" : ""].filter(Boolean).join(", ");
        return (
          <li key={day} className={`${routine.days.includes(day) ? "planned" : ""} ${day === today.getDay() ? "is-today" : ""} ${practiced.has(day) ? "practiced" : ""}`} aria-label={`${DAY_LABELS[day]}, ${state}`}>
            <span aria-hidden="true">{DAY_SHORT[day]}</span>
            <b aria-hidden="true">{practiced.has(day) && <Icon name="check" size={16} />}</b>
          </li>
        );
      })}
    </ul>
  );
}

export function HomePage() {
  const { child } = useChild();
  const navigate = useNavigate();
  const routine = useLoad(() => api<{ routine: Routine }>(`/children/${child.id}/routines`), [child.id]);
  const resumable = useLoad(() => api<{ session: { id: string; status: LearningSession["status"] } | null }>(`/children/${child.id}/sessions/resumable`), [child.id]);
  const progress = useLoad(() => api<{ progress: SkillProgress[] }>(`/children/${child.id}/progress`), [child.id]);
  const summaries = useLoad(() => api<{ summaries: Summary[] }>(`/children/${child.id}/summaries`), [child.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const { session } = await api<{ session: LearningSession }>(`/children/${child.id}/sessions`, { method: "POST", body: { durationMinutes: routine.data?.routine.durationMinutes ?? 10 } });
      navigate(`/sessions/${session.id}`);
    } catch (caught) {
      setError(caught);
      if (caught instanceof ApiError && caught.code === "SESSION_ALREADY_ACTIVE") void resumable.reload();
      setBusy(false);
    }
  }

  const current = routine.data?.routine;
  const next = current ? nextOccurrence(current) : null;
  const open = resumable.data?.session;
  const blocking = open && open.status !== "STOPPED";
  const skills = progress.data?.progress ?? [];
  const targets = skills.filter((skill) => skill.isTarget);
  const decisions = skills.filter((skill) => skill.status === "NEXT_STAGE_OFFERED");
  const isFirstTime = summaries.data?.summaries.length === 0 && !open;

  return (
    <div className="today">
      <section className="hero-card">
        <div className="hero-copy">
          <h1>{open ? `${child.nickname} punya sesi tersimpan` : `${child.nickname} siap melangkah`}</h1>
          <p>
            {open ? "Lanjutkan dari langkah terakhir. Semua jawaban aman." : `Sesi ${current?.durationMinutes ?? 10} menit: mulai, latihan, istirahat, selesai.`}
          </p>
          {targets.length > 0 && (
            <ul className="chips" aria-label="Latihan hari ini">
              {targets.map((skill) => <li key={skill.skillCode}><Icon name={SKILL_ICONS[skill.skillCode]} size={18} /> {SKILL_LABELS[skill.skillCode]}</li>)}
            </ul>
          )}
          <ErrorNotice error={error} />
          <div className="row">
            {open ? (
              <Link className="button big accent" to={`/sessions/${open.id}`}><Icon name="play" size={22} /> Lanjutkan sesi</Link>
            ) : (
              <button className="button big accent" onClick={startSession} disabled={busy || routine.loading}><Icon name="play" size={22} /> {busy ? "Menyiapkan…" : "Mulai sesi belajar"}</button>
            )}
            {open && !blocking && <button className="button ghost" onClick={startSession} disabled={busy}>Mulai sesi baru</button>}
            <Link className="button ghost" to={`/play/${child.id}`}>Buka Ruang Anak</Link>
          </div>
        </div>
        <Pipit className="hero-pipit" />
      </section>

      {decisions.length > 0 && (
        <section>
          <h2>Perlu keputusan Anda</h2>
          <div className="stack">
            {decisions.map((skill) => <ReviewCard key={skill.skillCode} skill={skill} childId={child.id} onReviewed={(updated) => progress.setData({ progress: updated })} />)}
          </div>
        </section>
      )}

      {isFirstTime && (
        <section className="tip-card">
          <Icon name="sprout" size={28} />
          <div>
            <h2>Belum tahu mulai dari mana?</h2>
            <p>Aktivitas awal membantu melihat titik mulai. Ini bukan tes dan tidak memberi nilai.</p>
            <Link className="button quiet" to={`/children/${child.id}/starter`}>Coba aktivitas awal</Link>
          </div>
        </section>
      )}

      <div className="today-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Jadwal</h2>
            <button className="text-button" onClick={() => setEditing(true)}>Ubah</button>
          </div>
          {routine.loading && !current && <Loading />}
          <ErrorNotice error={routine.error} />
          {current && (
            <>
              <WeekRhythm routine={current} summaries={summaries.data?.summaries ?? []} />
              <p className="muted">
                <Icon name="clock" size={18} /> Pukul {current.time}, {current.durationMinutes} menit.
                {current.remindersEnabled && next && ` Berikutnya ${next.today ? "hari ini" : DAY_LABELS[next.date.getDay()]}.`}
              </p>
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Perjalanan</h2>
            <Link className="text-link" to={`/children/${child.id}/progress`}>Lihat progres</Link>
          </div>
          {progress.loading && !progress.data && <Loading />}
          <ul className="mini-tracks">
            {targets.map((skill) => (
              <li key={skill.skillCode}>
                <span><Icon name={SKILL_ICONS[skill.skillCode]} size={20} /> {SKILL_LABELS[skill.skillCode]}</span>
                <Engklek size="sm" label={`Tahap ${SKILL_LABELS[skill.skillCode]}`} tiles={stageTiles(skill)} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {current && (
        <Sheet open={editing} onClose={() => setEditing(false)} title="Ubah jadwal">
          <RoutineForm childId={child.id} routine={current} onDone={(updated) => { if (updated) routine.setData({ routine: updated }); setEditing(false); }} />
        </Sheet>
      )}
    </div>
  );
}

function RoutineForm({ childId, routine, onDone }: { childId: string; routine: Routine; onDone: (routine?: Routine) => void }) {
  const [form, setForm] = useState(routine);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validate(routineUpdateSchema, form);
    setErrors(result.errors);
    if (!result.data) return;
    setBusy(true);
    try {
      const response = await api<{ routine: Routine }>(`/children/${childId}/routines`, { method: "PATCH", body: result.data });
      onDone(response.routine);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <ErrorNotice error={error} />
      <fieldset>
        <legend>Hari belajar</legend>
        <div className="day-picker">
          {WEEK.map((day) => (
            <label key={day}>
              <input type="checkbox" aria-label={DAY_LABELS[day]} checked={form.days.includes(day)} onChange={(e) => setForm({ ...form, days: e.target.checked ? [...form.days, day] : form.days.filter((item) => item !== day) })} />
              <span aria-hidden="true">{DAY_SHORT[day]}</span>
            </label>
          ))}
        </div>
        {errors.days && <p className="field-error">{errors.days}</p>}
      </fieldset>
      <Field label="Pukul" type="time" value={form.time} error={errors.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
      <div className="field">
        <label htmlFor="duration">Lama sesi</label>
        <select id="duration" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) as Routine["durationMinutes"] })}>
          {[5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes} menit</option>)}
        </select>
      </div>
      <Field label="Lama istirahat (menit)" type="number" inputMode="numeric" min={1} max={10} value={form.breakMinutes} error={errors.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
      <label className="toggle">
        <span><strong>Pengingat di beranda</strong><small>Tampilkan waktu belajar berikutnya</small></span>
        <input type="checkbox" role="switch" checked={form.remindersEnabled} onChange={(e) => setForm({ ...form, remindersEnabled: e.target.checked })} />
      </label>
      <button className="button wide" disabled={busy}>Simpan jadwal</button>
    </form>
  );
}

export function StarterPage() {
  const { child } = useChild();
  const navigate = useNavigate();
  const profile = useLoad(() => api<{ learningProfile: { targets: SkillCode[] } }>(`/children/${child.id}/learning-profile`), [child.id]);
  const [picked, setPicked] = useState<SkillCode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const skills = picked ?? profile.data?.learningProfile.targets ?? [];

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const skillCodes = SKILL_CODES.filter((code) => skills.includes(code));
      const { session } = await api<{ session: LearningSession }>(`/children/${child.id}/sessions`, { method: "POST", body: { type: "STARTER", skillCodes } });
      navigate(`/sessions/${session.id}`);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Aktivitas awal</h1>
      <p>Satu kegiatan ringan untuk tiap kemampuan. Ini bukan tes, tidak memberi nilai, dan tidak memengaruhi progres.</p>
      <ErrorNotice error={error ?? profile.error} />
      {profile.loading && !profile.data ? <Loading /> : <SkillPicker legend="Pilih kemampuan" value={skills} onChange={setPicked} />}
      <div className="row">
        <button className="button big" onClick={start} disabled={busy || skills.length === 0}>{busy ? "Menyiapkan…" : "Mulai aktivitas awal"}</button>
        <Link className="button quiet" to={`/children/${child.id}`}>Lewati</Link>
      </div>
    </div>
  );
}
