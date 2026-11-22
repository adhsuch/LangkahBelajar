import { accountUpdateSchema, childUpdateSchema, learningProfileUpdateSchema, passwordChangeSchema, shareChildSchema } from "@langkahbelajar/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, useLoad, type LearningProfile, type User } from "../api";
import { useAuth, useChild } from "../App";
import { exitChildMode } from "../childMode";
import { ErrorNotice, Field, LivePreview, Loading, Notice, PasswordField, PreferenceFields, SkillPicker, TextArea, validate } from "../components";
import { Icon } from "../ui/Icon";

function useSave() {
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      await action();
      setSaved(message);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  return { error, saved, busy, save };
}

export function SettingsPage() {
  const { child } = useChild();
  const { data, error, loading } = useLoad(() => api<{ learningProfile: LearningProfile }>(`/children/${child.id}/learning-profile`), [child.id]);
  const [tab, setTab] = useState<"child" | "account">("child");
  return (
    <div className="stack">
      <h1>Profil</h1>
      <div className="filters" role="group" aria-label="Bagian profil">
        <button type="button" aria-pressed={tab === "child"} onClick={() => setTab("child")}><Icon name="sprout" size={18} /> {child.nickname}</button>
        <button type="button" aria-pressed={tab === "account"} onClick={() => setTab("account")}><Icon name="user" size={18} /> Akun saya</button>
      </div>
      {tab === "child" && (
        <>
          <ErrorNotice error={error} />
          {loading && !data && <Loading />}
          {data && <ProfileForm key={child.id} initial={data.learningProfile} />}
          {child.isOwner && <ShareForm />}
        </>
      )}
      {tab === "account" && <AccountSection />}
    </div>
  );
}

function ProfileForm({ initial }: { initial: LearningProfile }) {
  const { child, reloadChild } = useChild();
  const [nickname, setNickname] = useState(child.nickname);
  const [targets, setTargets] = useState(initial.targets);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [initialNotes, setInitialNotes] = useState(initial.initialNotes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { error, saved, busy, save } = useSave();

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = validate(childUpdateSchema, { nickname });
    const profile = validate(learningProfileUpdateSchema, { targets, preferences, initialNotes });
    setErrors({ ...name.errors, ...profile.errors });
    if (!name.data || !profile.data) return;
    void save(async () => {
      await api(`/children/${child.id}`, { method: "PATCH", body: name.data });
      await api(`/children/${child.id}/learning-profile`, { method: "PATCH", body: profile.data });
      reloadChild();
    }, "Profil tersimpan. Perubahan berlaku mulai sesi berikutnya.");
  }

  return (
    <form className="settings-form" onSubmit={submit} noValidate>
      <div className="wizard-split">
        <div className="stack">
          <ErrorNotice error={error} />
          {saved && <Notice tone="good">{saved}</Notice>}
          <Field label="Nama panggilan" value={nickname} maxLength={30} error={errors.nickname} onChange={(e) => setNickname(e.target.value)} />
          <SkillPicker legend="Kemampuan yang dilatih" value={targets} onChange={setTargets} error={errors.targets} />
          <PreferenceFields value={preferences} onChange={setPreferences} />
          <TextArea label="Catatan kemampuan awal" hint="Tulis yang terlihat sehari-hari. Jangan tulis diagnosis atau data medis." value={initialNotes} maxLength={500} onChange={setInitialNotes} />
          <button className="button" disabled={busy}>Simpan profil</button>
        </div>
        <LivePreview preferences={preferences} />
      </div>
    </form>
  );
}

function ShareForm() {
  const { child } = useChild();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PARENT" | "TEACHER">("TEACHER");
  const [fieldError, setFieldError] = useState<string>();
  const { error, saved, busy, save } = useSave();

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validate(shareChildSchema, { email, role });
    setFieldError(result.errors.email);
    if (!result.data) return;
    void save(async () => {
      await api(`/children/${child.id}/caregivers`, { method: "POST", body: result.data });
      setEmail("");
    }, "Akses pendamping ditambahkan.");
  }

  return (
    <section className="panel">
      <h2>Dampingi bersama</h2>
      <p>Ajak guru atau orang tua lain untuk melihat dan mendampingi {child.nickname}. Mereka perlu punya akun lebih dulu.</p>
      <form className="share-form" onSubmit={submit} noValidate>
        <ErrorNotice error={error} />
        {saved && <Notice tone="good">{saved}</Notice>}
        <Field label="Email pendamping" type="email" autoCapitalize="none" value={email} error={fieldError} onChange={(e) => setEmail(e.target.value)} />
        <div className="field">
          <label htmlFor="share-role">Peran</label>
          <select id="share-role" value={role} onChange={(e) => setRole(e.target.value as "PARENT" | "TEACHER")}>
            <option value="TEACHER">Guru</option>
            <option value="PARENT">Orang tua</option>
          </select>
        </div>
        <button className="button quiet" disabled={busy}>Tambahkan pendamping</button>
      </form>
    </section>
  );
}

function AccountSection() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { error, saved, busy, save } = useSave();

  function saveName(event: FormEvent) {
    event.preventDefault();
    const result = validate(accountUpdateSchema, { displayName });
    setErrors(result.errors);
    if (!result.data) return;
    void save(async () => setUser((await api<{ user: User }>("/auth/me", { method: "PATCH", body: result.data })).user), "Nama akun tersimpan.");
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const result = validate(passwordChangeSchema, passwords);
    setErrors(result.errors);
    if (!result.data) return;
    void save(async () => {
      await api("/auth/password", { method: "POST", body: result.data });
      setPasswords({ currentPassword: "", newPassword: "" });
    }, "Kata sandi diperbarui. Perangkat lain sudah dikeluarkan.");
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    exitChildMode();
    setUser(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="stack">
      <ErrorNotice error={error} />
      {saved && <Notice tone="good">{saved}</Notice>}
      <div className="account-panels">
      <section className="panel">
        <h2>Akun pendamping</h2>
        <p className="muted">{user?.email}</p>
        <form onSubmit={saveName} noValidate>
          <Field label="Nama Anda" autoComplete="name" maxLength={60} value={displayName} error={errors.displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <button className="button quiet" disabled={busy}>Simpan nama</button>
        </form>
      </section>
      <section className="panel">
        <h2>Ganti kata sandi</h2>
        <form onSubmit={savePassword} noValidate>
          <PasswordField label="Kata sandi saat ini" autoComplete="current-password" value={passwords.currentPassword} error={errors.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          <PasswordField label="Kata sandi baru" autoComplete="new-password" hint="Minimal 10 karakter." value={passwords.newPassword} error={errors.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
          <button className="button quiet" disabled={busy}>Ganti kata sandi</button>
        </form>
      </section>
      </div>
      <button className="button quiet logout" onClick={logout}><Icon name="exit" size={20} /> Keluar dari akun</button>
    </div>
  );
}
