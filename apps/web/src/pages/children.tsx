import { childCreateSchema, type SkillCode } from "@langkahbelajar/shared";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, useLoad, type Child } from "../api";
import { useAuth } from "../App";
import { ErrorNotice, Field, LivePreview, Loading, PreferenceFields, SkillPicker, TextArea, initialPreferences, validate } from "../components";
import { Icon } from "../ui/Icon";
import { Pipit } from "../ui/Pipit";
import { Engklek, type TileState } from "../ui/Engklek";

export function ChildrenPage() {
  const { user } = useAuth();
  const { data, error, loading } = useLoad(() => api<{ children: Child[] }>("/children"), []);
  if (loading && !data) return <main className="page narrow"><Loading /></main>;
  if (data?.children.length === 1) return <Navigate to={`/children/${data.children[0]!.id}`} replace />;

  if (data?.children.length === 0) {
    const tiles = ["Profil", "Pilih latihan", "Atur bantuan", "Mulai"].map((label, index) => ({
      key: label,
      label,
      state: (index === 0 ? "current" : "todo") as TileState,
    }));
    return (
      <main className="welcome">
        <section className="welcome-hero">
          <p className="auth-brand"><img src="/icon.svg" alt="" width="36" height="36" /> LangkahBelajar</p>
          <h1>Halo, {user?.displayName}. Ayo siapkan langkah pertama.</h1>
          <p>Dalam 2 menit, Anda bisa menyiapkan latihan yang sesuai dengan cara belajar anak.</p>
          <Engklek size="lg" label="Langkah menyiapkan profil" tiles={tiles} />
        </section>
        <section className="welcome-body">
          <h2>Yang akan kita siapkan</h2>
          <ol className="welcome-steps">
            <li><strong>Kenalkan anak.</strong> Cukup nama panggilan, tanpa diagnosis.</li>
            <li><strong>Pilih latihan.</strong> Membaca, menulis, berhitung, dan lainnya.</li>
            <li><strong>Atur bantuan.</strong> Lihat langsung tampilan untuk anak.</li>
          </ol>
          <Link className="button big accent" to="/children/new">Buat profil anak</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page page-full">
      <p className="auth-brand dark"><img src="/icon.svg" alt="" width="32" height="32" /> LangkahBelajar</p>
      <h1>Siapa yang belajar hari ini?</h1>
      <ErrorNotice error={error} />
      <ul className="child-list">
        {data?.children.map((child) => (
          <li key={child.id}>
            <Link to={`/children/${child.id}`}>
              <Pipit className="pipit-small" />
              <strong>{child.nickname}</strong>
              {child.isSample && <span className="muted">data contoh</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link className="button quiet" to="/children/new"><Icon name="plus" size={20} /> Tambah anak</Link>
    </main>
  );
}

const STEPS = ["Nama", "Latihan", "Bantuan", "Mulai"];

export function NewChildPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [targets, setTargets] = useState<SkillCode[]>(["READING", "COUNTING"]);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [initialNotes, setInitialNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const tiles = STEPS.map((label, index) => ({
    key: label,
    label,
    state: (index < step ? "done" : index === step ? "current" : "todo") as TileState,
  }));

  function next() {
    const result = validate(childCreateSchema, { nickname, targets, preferences, initialNotes });
    const relevant = step === 0 ? { nickname: result.errors.nickname } : step === 1 ? { targets: result.errors.targets } : {};
    const shown = Object.fromEntries(Object.entries(relevant).filter(([, value]) => value)) as Record<string, string>;
    setErrors(shown);
    if (Object.keys(shown).length === 0) setStep(step + 1);
  }

  async function finish(destination: "starter" | "home") {
    const result = validate(childCreateSchema, { nickname, targets, preferences, initialNotes });
    if (!result.data) return;
    setBusy(true);
    setError(null);
    try {
      const { child } = await api<{ child: Child }>("/children", { method: "POST", body: result.data });
      navigate(destination === "starter" ? `/children/${child.id}/starter` : `/children/${child.id}`, { replace: true });
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <main className="wizard">
      <div className="wizard-rail">
        <p className="auth-brand"><img src="/icon.svg" alt="" width="36" height="36" /> LangkahBelajar</p>
        <div className="wizard-top">
          {step === 0 ? (
            <Link className="icon-button" to="/" aria-label="Kembali"><Icon name="back" /></Link>
          ) : (
            <button type="button" className="icon-button" aria-label="Langkah sebelumnya" onClick={() => setStep(step - 1)}><Icon name="back" /></button>
          )}
          <p>Langkah {step + 1} dari {STEPS.length}</p>
        </div>
        <Engklek size="sm" label="Langkah membuat profil" tiles={tiles} />
        <ol className="wizard-steps" aria-hidden="true">
          {STEPS.map((label, index) => <li key={label} className={index === step ? "active" : index < step ? "past" : ""}>{label}</li>)}
        </ol>
      </div>
      <div className="wizard-content">
      <ErrorNotice error={error} />

      {step === 0 && (
        <form onSubmit={(event) => { event.preventDefault(); next(); }} noValidate>
          <h1>Siapa nama panggilannya?</h1>
          <p>Anda tidak perlu menuliskan nama lengkap atau diagnosis.</p>
          <Field label="Nama panggilan" autoFocus value={nickname} maxLength={30} error={errors.nickname} onChange={(e) => setNickname(e.target.value)} />
          <button className="button big">Lanjut</button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={(event) => { event.preventDefault(); next(); }} noValidate>
          <h1>Apa yang ingin {nickname} latih?</h1>
          <SkillPicker legend="Pilih satu atau lebih" value={targets} onChange={setTargets} error={errors.targets} />
          <button className="button big">Lanjut</button>
        </form>
      )}

      {step === 2 && (
        <div className="wizard-split">
          <div>
            <h1>Bagaimana {nickname} paling nyaman belajar?</h1>
            <p>Ubah pilihan dan lihat hasilnya. Semua bisa diganti kapan saja.</p>
            <PreferenceFields value={preferences} onChange={setPreferences} />
            <button type="button" className="button big" onClick={next}>Lanjut</button>
          </div>
          <LivePreview preferences={preferences} />
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <h1>{nickname} siap melangkah</h1>
          <TextArea label="Catatan kemampuan awal (opsional)" hint="Tulis yang terlihat sehari-hari. Jangan tulis diagnosis atau data medis." value={initialNotes} maxLength={500} onChange={setInitialNotes} />
          <div className="choice-cards">
            <button type="button" className="option-card" disabled={busy} onClick={() => finish("starter")}>
              <Icon name="sprout" size={28} />
              <strong>Coba aktivitas awal</strong>
              <span>Kegiatan ringan untuk melihat titik mulai. Bukan tes.</span>
            </button>
            <button type="button" className="option-card" disabled={busy} onClick={() => finish("home")}>
              <Icon name="home" size={28} />
              <strong>Langsung ke beranda</strong>
              <span>Mulai dari tahap pertama di setiap latihan.</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
