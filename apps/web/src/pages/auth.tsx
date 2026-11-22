import { loginSchema, registerSchema } from "@langkahbelajar/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, type User } from "../api";
import { useAuth } from "../App";
import { ErrorNotice, Field, PasswordField, validate } from "../components";
import { Icon } from "../ui/Icon";
import { Engklek, type TileState } from "../ui/Engklek";

const DEMO = ["Mulai", "Latihan", "Istirahat", "Selesai"];

function EngklekDemo() {
  const [position, setPosition] = useState(0);
  const finished = position === DEMO.length - 1;
  const tiles = DEMO.map((label, index) => ({
    key: label,
    label,
    state: (index < position ? "done" : index === position ? "current" : "todo") as TileState,
  }));
  return (
    <div className="demo">
      <Engklek size="lg" label="Contoh perjalanan belajar" tiles={tiles} />
      <div className="demo-row">
        <p aria-live="polite"><strong>{DEMO[position]}</strong></p>
        <button type="button" className="button accent" onClick={() => setPosition(finished ? 0 : position + 1)}>
          <Icon name={finished ? "retry" : "play"} size={20} /> {finished ? "Ulangi" : "Coba melangkah"}
        </button>
      </div>
    </div>
  );
}

function AuthFrame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-form">
        <p className="auth-brand dark"><img src="/icon.svg" alt="" width="36" height="36" /> LangkahBelajar</p>
        <h1>{title}</h1>
        <p>{intro}</p>
        {children}
        <p className="fine">Dukungan belajar ini perlu dievaluasi bersama pendidik. Aplikasi ini bukan alat diagnosis atau pengganti terapi.</p>
      </main>
      <section className="auth-hero" aria-label="Cara belajar di LangkahBelajar">
        <h2>Belajar membaca, menulis, dan berhitung, satu langkah setiap kali.</h2>
        <EngklekDemo />
      </section>
    </div>
  );
}

function useAuthForm(path: "login" | "register") {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function send(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>(`/auth/${path}`, { method: "POST", body });
      setUser(user);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, send };
}

export function LoginPage() {
  const { user } = useAuth();
  const { busy, error, send } = useAuthForm("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (user) return <Navigate to="/" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validate(loginSchema, form);
    setErrors(result.errors);
    if (result.data) void send(result.data);
  }

  return (
    <AuthFrame title="Masuk" intro="Masuk sebagai orang tua atau guru pendamping.">
      <form onSubmit={submit} noValidate>
        <ErrorNotice error={error} />
        <Field label="Email" type="email" autoComplete="email" autoCapitalize="none" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <PasswordField label="Kata sandi" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="button wide" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
      </form>
      <p>Belum punya akun? <Link to="/register">Daftar</Link></p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { user } = useAuth();
  const { busy, error, send } = useAuthForm("register");
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (user) return <Navigate to="/" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validate(registerSchema, form);
    setErrors(result.errors);
    if (result.data) void send(result.data);
  }

  return (
    <AuthFrame title="Buat akun pendamping" intro="Untuk orang tua atau guru. Anak tidak perlu punya akun.">
      <form onSubmit={submit} noValidate>
        <ErrorNotice error={error} />
        <Field label="Nama Anda" autoComplete="name" maxLength={60} value={form.displayName} error={errors.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <Field label="Email" type="email" autoComplete="email" autoCapitalize="none" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <PasswordField label="Kata sandi" autoComplete="new-password" hint="Minimal 10 karakter." value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="button wide" disabled={busy}>{busy ? "Membuat akun…" : "Buat akun"}</button>
      </form>
      <p>Sudah punya akun? <Link to="/login">Masuk</Link></p>
    </AuthFrame>
  );
}
