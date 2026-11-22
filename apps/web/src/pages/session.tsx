import type { Answer, Support } from "@langkahbelajar/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, newIdempotencyKey, useLoad, type LearningSession, type Routine, type SessionStep } from "../api";
import { enterChildMode, exitChildMode } from "../childMode";
import { ErrorNotice, Loading, MaterialView, Notice } from "../components";
import { REASON_LABELS, SKILL_LABELS } from "../copy";
import { speak } from "../speech";
import { Icon, SKILL_ICONS, type IconName } from "../ui/Icon";
import { Pipit } from "../ui/Pipit";
import { Engklek, type TileState } from "../ui/Engklek";
import { ExitGate } from "./play";
import { ChoiceResponse, CountBoard, DoneResponse, OrderResponse, StepStrip, TraceResponse, countableObjects } from "./practice";

const STEP_LABELS = { START: "Mulai", BREAK: "Istirahat", FINISH: "Selesai" };
const stepLabel = (step: SessionStep) => (step.kind === "PRACTICE" ? (step.activity?.title ?? `${SKILL_LABELS[step.skillCode!]} ditunda`) : STEP_LABELS[step.kind]);

function tileState(step: SessionStep, currentId: string | null): TileState {
  if (step.id === currentId) return "current";
  if (step.status === "COMPLETED") return "done";
  if (step.status === "SKIPPED") return "skipped";
  if (step.status === "POSTPONED") return "postponed";
  return "todo";
}

const stepIcon = (step: SessionStep): IconName =>
  step.kind === "PRACTICE" && step.skillCode ? SKILL_ICONS[step.skillCode] : step.kind === "BREAK" ? "pause" : step.kind === "FINISH" ? "check" : "play";

function useFocusHeading() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return heading;
}

function NowNext({ session, step }: { session: LearningSession; step: SessionStep }) {
  const next = session.steps.find((item) => item.position > step.position && item.status === "PENDING");
  return (
    <dl className="now-next">
      <div className="now"><dt>Sekarang</dt><dd><Icon name={stepIcon(step)} size={20} /> {step.kind === "PRACTICE" ? SKILL_LABELS[step.skillCode!] : stepLabel(step)}</dd></div>
      {next && <div><dt>Berikutnya</dt><dd><Icon name={stepIcon(next)} size={20} /> {next.kind === "PRACTICE" ? SKILL_LABELS[next.skillCode!] : stepLabel(next)}</dd></div>}
    </dl>
  );
}

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { data: session, error: loadError, setData } = useLoad(() => api<{ session: LearningSession }>(`/sessions/${sessionId}`).then((r) => r.session), [sessionId]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState<SessionStep | null>(null);
  const childId = session?.childId;

  useEffect(() => {
    if (childId) enterChildMode(childId);
  }, [childId]);

  async function run(action: () => Promise<{ session: LearningSession }>) {
    setBusy(true);
    setError(null);
    try {
      setData((await action()).session);
      window.scrollTo(0, 0);
    } catch (caught) {
      setError(caught);
      await api<{ session: LearningSession }>(`/sessions/${sessionId}`).then((r) => setData(r.session)).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="page narrow">
        {loadError ? <><ErrorNotice error={loadError} /><Link className="button quiet" to="/" onClick={exitChildMode}>Kembali</Link></> : <Loading />}
      </main>
    );
  }

  const transition = (action: "pause" | "resume" | "stop") => run(() => api(`/sessions/${session.id}/${action}`, { method: "PATCH" }));
  const advance = () => run(() => api(`/sessions/${session.id}/steps/${session.currentStepId}/advance`, { method: "POST" }));
  const refresh = () => run(() => api(`/sessions/${session.id}`));
  const begin = () =>
    run(async () => {
      const started = await api<{ session: LearningSession }>(`/sessions/${session.id}/start`, { method: "PATCH" });
      return api(`/sessions/${session.id}/steps/${started.session.currentStepId}/advance`, { method: "POST" });
    });

  async function leave() {
    if (session?.status === "IN_PROGRESS") await api(`/sessions/${session.id}/pause`, { method: "PATCH" }).catch(() => undefined);
    exitChildMode();
    navigate(`/children/${session!.childId}`, { replace: true });
  }

  async function toMap() {
    if (session?.status === "PAUSED" || session?.status === "PLANNED") await api(`/sessions/${session.id}/stop`, { method: "PATCH" }).catch(() => undefined);
    navigate(`/play/${session!.childId}`, { replace: true });
  }

  const step = session.steps.find((candidate) => candidate.id === session.currentStepId);
  const { preferences } = session.profileSnapshot;
  const current = session.status === "COMPLETED" ? null : session.currentStepId;
  const pipitIndex = step ? session.steps.indexOf(step) : session.steps.length - 1;

  return (
    <div className="play play-scale" data-text={preferences.textSize} data-motion={preferences.reduceMotion ? "off" : "on"}>
      <header className="play-top">
        <ExitGate onExit={leave} />
        <Engklek size="sm" label="Langkah sesi" pipitIndex={pipitIndex} resting={session.status === "PAUSED" || session.status === "STOPPED" || step?.kind === "BREAK"} tiles={session.steps.map((item) => ({ key: item.id, label: stepLabel(item), state: tileState(item, current) }))} />
        {session.status === "IN_PROGRESS" && (
          <button type="button" className="icon-button big-icon" aria-label="Jeda" onClick={() => transition("pause")} disabled={busy}><Icon name="pause" size={26} /></button>
        )}
      </header>
      <main className="play-main">
        <ErrorNotice error={error} />
        {session.status === "PLANNED" && <Overview session={session} onBegin={begin} onLater={toMap} busy={busy} />}
        {(session.status === "PAUSED" || session.status === "STOPPED") && <RestScreen paused={session.status === "PAUSED"} busy={busy} onResume={() => transition("resume")} onMap={toMap} />}
        {session.status === "COMPLETED" && <FinishScreen session={session} onMap={toMap} />}
        {session.status === "IN_PROGRESS" && arrived && (
          <Arrival onNext={() => { const stale = session.currentStepId === arrived.id; setArrived(null); if (stale) void refresh(); }} />
        )}
        {session.status === "IN_PROGRESS" && !arrived && step?.kind === "PRACTICE" && (
          <PracticeStep key={step.id} step={step} session={session} busy={busy} onCorrect={() => { setArrived(step); void refresh(); }} onSkip={advance} />
        )}
        {session.status === "IN_PROGRESS" && !arrived && step?.kind === "BREAK" && <BreakStep key={step.id} session={session} step={step} onDone={advance} busy={busy} />}
        {session.status === "IN_PROGRESS" && !arrived && step?.kind === "FINISH" && <LastStep session={session} onDone={advance} busy={busy} />}
      </main>
    </div>
  );
}

function Overview({ session, onBegin, onLater, busy }: { session: LearningSession; onBegin: () => void; onLater: () => void; busy: boolean }) {
  const heading = useFocusHeading();
  const practice = session.steps.filter((step) => step.kind === "PRACTICE");
  const example = practice.find((step) => step.activity?.example)?.activity?.example;
  const postponed = practice.some((step) => step.status === "POSTPONED");
  return (
    <section className="task task-overview">
      <div className="overview-plan">
      <h1 ref={heading} tabIndex={-1}>{session.type === "STARTER" ? "Aktivitas awal" : "Hari ini kita akan"}</h1>
      <ol className="schedule">
        {session.steps.map((step) => (
          <li key={step.id} className={step.status === "POSTPONED" ? "postponed" : ""}>
            <span aria-hidden="true"><Icon name={stepIcon(step)} size={22} /></span>
            {stepLabel(step)}
          </li>
        ))}
      </ol>
      </div>
      <div className="overview-start">
      {postponed && <Notice>Sebagian aktivitas ditunda karena belum bisa dimuat. Progres tetap aman.</Notice>}
      {example && <div className="callout"><h2>Contoh</h2><p>{example}</p></div>}
      <ul className="supports" aria-label="Bantuan yang tersedia">
        <li><Icon name="speaker" size={20} /> Dengar</li>
        <li><Icon name="bulb" size={20} /> Petunjuk</li>
        <li><Icon name="eye" size={20} /> Contoh</li>
        <li><Icon name="pause" size={20} /> Jeda</li>
      </ul>
      <div className="row task-cta">
        <button className="button huge accent" onClick={onBegin} disabled={busy}><Icon name="play" size={28} /> Mulai</button>
        <button className="button quiet" onClick={onLater} disabled={busy}>Nanti saja</button>
      </div>
      </div>
    </section>
  );
}

function RestScreen({ paused, busy, onResume, onMap }: { paused: boolean; busy: boolean; onResume: () => void; onMap: () => void }) {
  const heading = useFocusHeading();
  return (
    <section className="task center">
      <Pipit className="scene-pipit" resting />
      <h1 ref={heading} tabIndex={-1}>{paused ? "Pipit menunggu di sini" : "Sesi disimpan"}</h1>
      <p>Jawabanmu aman. Lanjutkan kapan saja.</p>
      <div className="row center">
        <button className="button huge accent" onClick={onResume} disabled={busy}><Icon name="play" size={28} /> Lanjutkan</button>
        <button className="button quiet" onClick={onMap} disabled={busy}>Ke peta</button>
      </div>
    </section>
  );
}

function Arrival({ onNext }: { onNext: () => void }) {
  const heading = useFocusHeading();
  return (
    <section className="task center arrival" aria-live="polite">
      <Pipit className="scene-pipit" />
      <h1 ref={heading} tabIndex={-1}>Bagus, satu langkah lagi!</h1>
      <p>Jawabanmu sudah tersimpan.</p>
      <button className="button huge accent" onClick={onNext}>Lanjut</button>
    </section>
  );
}

function LastStep({ session, onDone, busy }: { session: LearningSession; onDone: () => void; busy: boolean }) {
  const heading = useFocusHeading();
  return (
    <section className="task center">
      <Pipit className="scene-pipit" />
      <h1 ref={heading} tabIndex={-1}>Hampir sampai</h1>
      {session.steps.some((item) => item.status === "POSTPONED") && <Notice>Sebagian aktivitas ditunda karena belum bisa dimuat. Progres tetap aman.</Notice>}
      <button className="button huge accent" onClick={onDone} disabled={busy}><Icon name="check" size={28} /> Selesaikan sesi</button>
    </section>
  );
}

function FinishScreen({ session, onMap }: { session: LearningSession; onMap: () => void }) {
  const heading = useFocusHeading();
  const practiced = [...new Set(session.steps.filter((step) => step.status === "COMPLETED" && step.skillCode).map((step) => step.skillCode!))];
  return (
    <section className="task center">
      <Pipit className="scene-pipit" />
      <h1 ref={heading} tabIndex={-1}>Sesi selesai</h1>
      <p>Terima kasih sudah belajar hari ini.</p>
      {practiced.length > 0 && (
        <ul className="chips center" aria-label="Yang dilatih hari ini">
          {practiced.map((skill) => <li key={skill}><Icon name={SKILL_ICONS[skill]} size={18} /> {SKILL_LABELS[skill]}</li>)}
        </ul>
      )}
      <button className="button huge accent" onClick={onMap}>Ke peta</button>
    </section>
  );
}

function TryAgain({ busy, onRetry, onSkip }: { busy: boolean; onRetry: () => void; onSkip: () => void }) {
  const heading = useFocusHeading();
  return (
    <section className="task center" aria-live="polite">
      <Pipit className="scene-pipit" />
      <h1 ref={heading} tabIndex={-1}>Coba lagi, yuk</h1>
      <p>Pelan-pelan saja. Kamu juga boleh lanjut dulu.</p>
      <div className="row center">
        <button className="button huge accent" onClick={onRetry}><Icon name="retry" size={26} /> Coba lagi</button>
        <button className="button quiet" onClick={onSkip} disabled={busy}>Lanjut dulu</button>
      </div>
    </section>
  );
}

function PracticeStep({ step, session, busy, onCorrect, onSkip }: { step: SessionStep; session: LearningSession; busy: boolean; onCorrect: () => void; onSkip: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const activity = step.activity!;
  const { preferences } = session.profileSnapshot;
  const first = activity.steps[0]!;
  // Counting objects and "gambar ini" pictures are the question itself, so the visual-cue setting cannot hide them.
  const visualIsContent = step.skillCode === "COUNTING" || /gambar/i.test(first.instruction);
  const showVisual = Boolean(first.visual) && (visualIsContent || preferences.visualCues);
  const objects = step.skillCode === "COUNTING" ? countableObjects(first.visual) : [];
  const [support, setSupport] = useState<Support[]>(showVisual && !visualIsContent ? ["VISUAL_CUE"] : []);
  const [panel, setPanel] = useState<"hint" | "example" | "material" | null>(null);
  const [retry, setRetry] = useState(false);
  const [round, setRound] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Keeps the key across a failed send, so a retry cannot record the same answer twice.
  const pending = useRef<{ answer: Answer; supportUsed: Support[]; key: string } | null>(null);

  const use = (item: Support) => setSupport((current) => (current.includes(item) ? current : [...current, item]));
  const say = (text: string) => { if (speak(text)) use("AUDIO"); };
  const instruction = activity.steps.map((item) => item.instruction).join(" ");
  const steps = activity.steps.map((item) => item.instruction);

  async function send(answer?: Answer) {
    if (answer) pending.current = { answer, supportUsed: support, key: newIdempotencyKey() };
    if (!pending.current) return;
    setSending(true);
    setError(null);
    try {
      const { result } = await api<{ result: { isCorrect: boolean } }>(`/sessions/${session.id}/steps/${step.id}/results`, {
        method: "POST",
        headers: { "idempotency-key": pending.current.key },
        body: { answer: pending.current.answer, supportUsed: pending.current.supportUsed },
      });
      pending.current = null;
      if (result.isCorrect) onCorrect();
      else setRetry(true);
    } catch (caught) {
      // Only a lost connection leaves the outcome unknown. The server has rejected anything else.
      if (!(caught instanceof ApiError && caught.status === 0)) pending.current = null;
      setError(caught);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!retry) heading.current?.focus({ preventScroll: true });
  }, [retry]);

  if (retry) return <TryAgain busy={busy} onRetry={() => { setRetry(false); setRound(round + 1); }} onSkip={onSkip} />;

  const disabled = busy || sending || Boolean(pending.current);
  const response = activity.response;
  return (
    <section className="task task-practice">
      <div className="task-prompt">
      <NowNext session={session} step={step} />
      <div className="task-head">
        {preferences.audioEnabled && (
          <button type="button" className="sound-button" aria-label="Dengar instruksi" onClick={() => { if (speak(instruction)) { use("AUDIO"); use("REPEAT_INSTRUCTION"); } }}>
            <Icon name="speaker" size={28} />
          </button>
        )}
        <h1 ref={heading} tabIndex={-1} className="task-title">{steps.length > 1 ? activity.title : first.instruction}</h1>
      </div>
      {preferences.responseMethod === "CAREGIVER_ASSISTED" && <p className="hint">Anak menunjuk jawaban, pendamping yang menekan.</p>}

      {objects.length > 0 ? (
        <CountBoard key={`count-${round}`} tokens={objects} onCount={preferences.audioEnabled ? (count) => say(String(count)) : undefined} />
      ) : (
        showVisual && <p className="task-visual" role="img" aria-label="Gambar petunjuk">{first.visual}</p>
      )}
      </div>

      <div className="task-answer">
      <div key={round}>
        {response.kind === "choice" && <ChoiceResponse options={response.options ?? []} disabled={disabled} onAnswer={(value) => send({ type: "choice", value })} onHear={preferences.audioEnabled ? say : undefined} />}
        {response.kind === "order" && <OrderResponse options={response.options ?? []} disabled={disabled} onAnswer={(values) => send({ type: "order", values })} />}
        {response.kind === "trace" && <TraceResponse letter={response.target ?? ""} disabled={disabled} onDone={() => send({ type: "completed" })} />}
        {response.kind === "done" && <DoneResponse steps={steps} disabled={disabled} onDone={() => send({ type: "completed" })} />}
        {response.kind === "paper" && (
          <div className="stack">
            {response.target && <p className="copy-word">{response.target}</p>}
            {steps.length > 1 && <StepStrip steps={steps} active={0} />}
            <div className="handoff">
              <h2>Untuk pendamping</h2>
              <p>Lihat tulisan di kertas. Aplikasi tidak menilai tulisan tangan.</p>
              <div className="row">
                <button className="button" disabled={disabled} onClick={() => send({ type: "caregiver_confirmed", confirmed: true })}>Sudah menulis</button>
                <button className="button quiet" disabled={disabled} onClick={() => send({ type: "caregiver_confirmed", confirmed: false })}>Belum</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div>
          <ErrorNotice error={error} />
          {pending.current && <button className="button" onClick={() => send()} disabled={sending}>Kirim ulang jawaban</button>}
        </div>
      ) : null}

      {panel === "hint" && <div className="callout reveal"><h2>Petunjuk</h2><p>{activity.hint}</p></div>}
      {panel === "example" && <div className="callout reveal"><h2>Contoh</h2><p>{activity.example}</p></div>}
      {panel === "material" && step.material && <div className="reveal"><MaterialView material={step.material} /></div>}
      {step.adaptationReason && <p className="fine">{REASON_LABELS[step.adaptationReason]}</p>}
      </div>

      <div className="helpers" role="group" aria-label="Bantuan">
        {activity.hint && <button type="button" aria-pressed={panel === "hint"} onClick={() => { setPanel(panel === "hint" ? null : "hint"); use("HINT"); }}><Icon name="bulb" /> Petunjuk</button>}
        {activity.example && <button type="button" aria-pressed={panel === "example"} onClick={() => { setPanel(panel === "example" ? null : "example"); use("WORKED_EXAMPLE"); }}><Icon name="eye" /> Contoh</button>}
        {step.material && <button type="button" aria-pressed={panel === "material"} onClick={() => setPanel(panel === "material" ? null : "material")}><Icon name="book" /> Materi</button>}
        <button type="button" onClick={onSkip} disabled={busy}><Icon name="skip" /> Lewati</button>
      </div>
    </section>
  );
}

function BreakStep({ session, step, onDone, busy }: { session: LearningSession; step: SessionStep; onDone: () => void; busy: boolean }) {
  const heading = useFocusHeading();
  const routine = useLoad(() => api<{ routine: Routine }>(`/children/${session.childId}/routines`), [session.childId]);
  const planned = routine.data?.routine.breakMinutes;
  const options = [...new Set([1, 2, 3, ...(planned ? [planned] : [])])].sort((a, b) => a - b);
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (left === null || left <= 0) return;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const clock = left === null ? "" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const circumference = 2 * Math.PI * 54;
  return (
    <section className="task center">
      <NowNext session={session} step={step} />
      <Pipit className="scene-pipit" resting />
      <h1 ref={heading} tabIndex={-1}>Waktunya istirahat</h1>
      <p>Regangkan badan atau minum air.</p>
      {left === null ? (
        <div className="row center" role="group" aria-label="Pilih lama istirahat">
          {options.map((minutes) => (
            <button key={minutes} className={minutes === planned ? "button" : "button quiet"} onClick={() => { setTotal(minutes * 60); setLeft(minutes * 60); }}>
              {minutes} menit{minutes === planned ? " (jadwal)" : ""}
            </button>
          ))}
        </div>
      ) : (
        <div className="timer" role="timer" aria-live="off" aria-label={left > 0 ? `Sisa ${clock}` : "Istirahat selesai"}>
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#E6E8F8" strokeWidth="10" />
            <circle cx="60" cy="60" r="54" fill="none" stroke="#5561C4" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - left / (total || 1))} transform="rotate(-90 60 60)" />
          </svg>
          <span>{left > 0 ? clock : "Selesai"}</span>
        </div>
      )}
      <button className="button huge accent" onClick={onDone} disabled={busy}><Icon name="play" size={26} /> Lanjut belajar</button>
    </section>
  );
}
