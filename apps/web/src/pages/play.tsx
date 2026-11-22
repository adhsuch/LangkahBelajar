import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, useLoad, type Child, type LearningProfile, type LearningSession, type Routine, type SkillProgress } from "../api";
import { enterChildMode, exitChildMode } from "../childMode";
import { ErrorNotice, Loading, Sheet } from "../components";
import { SKILL_LABELS } from "../copy";
import { Icon, SKILL_ICONS } from "../ui/Icon";
import { Pipit } from "../ui/Pipit";
import { Engklek } from "../ui/Engklek";
import { stageTiles } from "./home";

const HOLD_MS = 2000;

/** Press and hold for caregivers. A short press opens a typed alternative for people who cannot hold. */
export function ExitGate({ onExit }: { onExit: () => void }) {
  const [holding, setHolding] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const timer = useRef<number | null>(null);
  const exited = useRef(false);

  const begin = () => {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      exited.current = true;
      onExit();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);

  return (
    <>
      <button
        type="button"
        className="hold"
        data-holding={holding}
        aria-label="Keluar, khusus pendamping"
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => { if (!exited.current) setAskOpen(true); }}
      >
        <span className="hold-fill" aria-hidden="true" />
        <Icon name="exit" size={22} />
      </button>
      <Sheet open={askOpen} onClose={() => { setAskOpen(false); setTyped(""); }} title="Untuk pendamping">
        <form onSubmit={(event) => { event.preventDefault(); if (typed.trim().toUpperCase() === "KELUAR") onExit(); }}>
          <p>Tahan tombol keluar selama 2 detik, atau ketik KELUAR di bawah.</p>
          <div className="field">
            <label htmlFor="exit-word">Ketik KELUAR</label>
            <input id="exit-word" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </div>
          <button className="button wide" disabled={typed.trim().toUpperCase() !== "KELUAR"}>Kembali ke Ruang Pendamping</button>
        </form>
      </Sheet>
    </>
  );
}

export function PlayPage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const child = useLoad(() => api<{ child: Child }>(`/children/${childId}`), [childId]);
  const profile = useLoad(() => api<{ learningProfile: LearningProfile }>(`/children/${childId}/learning-profile`), [childId]);
  const progress = useLoad(() => api<{ progress: SkillProgress[] }>(`/children/${childId}/progress`), [childId]);
  const resumable = useLoad(() => api<{ session: { id: string } | null }>(`/children/${childId}/sessions/resumable`), [childId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (child.data) enterChildMode(child.data.child.id);
  }, [child.data]);

  if (child.error instanceof ApiError && child.error.status === 404) {
    exitChildMode();
    return <Navigate to="/" replace />;
  }
  if (!child.data || !profile.data || !progress.data) {
    return <main className="page narrow">{child.error || progress.error ? <ErrorNotice error={child.error ?? progress.error} /> : <Loading />}</main>;
  }

  const { preferences } = profile.data.learningProfile;
  const open = resumable.data?.session;
  const skills = progress.data.progress.filter((skill) => skill.isTarget);

  async function begin() {
    if (open) return navigate(`/sessions/${open.id}`);
    setBusy(true);
    setError(null);
    try {
      const { routine } = await api<{ routine: Routine }>(`/children/${childId}/routines`);
      const { session } = await api<{ session: LearningSession }>(`/children/${childId}/sessions`, { method: "POST", body: { durationMinutes: routine.durationMinutes } });
      navigate(`/sessions/${session.id}`);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <div className="play play-scale" data-text={preferences.textSize} data-motion={preferences.reduceMotion ? "off" : "on"}>
      <header className="play-top">
        <ExitGate onExit={() => { exitChildMode(); navigate(`/children/${childId}`, { replace: true }); }} />
      </header>
      <main className="play-main play-map">
        <section className="map-hero">
          <Pipit className="map-pipit" />
          <h1>Halo, {child.data.child.nickname}!</h1>
          <ErrorNotice error={error} />
          <button className="button huge accent" onClick={begin} disabled={busy}>
            <Icon name="play" size={30} /> {busy ? "Menyiapkan…" : open ? "Lanjutkan" : "Ayo mulai"}
          </button>
        </section>
        <ul className="map">
          {skills.map((skill) => (
            <li key={skill.skillCode}>
              <h2><Icon name={SKILL_ICONS[skill.skillCode]} /> {SKILL_LABELS[skill.skillCode]}</h2>
              <Engklek size="lg" label={`Jalan ${SKILL_LABELS[skill.skillCode]}`} tiles={stageTiles(skill)} onCurrent={busy ? undefined : begin} currentLabel={`Mulai ${SKILL_LABELS[skill.skillCode]}`} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
