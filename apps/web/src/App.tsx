import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ApiError, api, useLoad, type Child, type User } from "./api";
import { exitChildMode, getChildMode } from "./childMode";
import { ErrorNotice, Loading, VoiceNotice } from "./components";
import { LoginPage, RegisterPage } from "./pages/auth";
import { ChildrenPage, NewChildPage } from "./pages/children";
import { HomePage, StarterPage } from "./pages/home";
import { MaterialsPage, OfflinePage } from "./pages/materials";
import { PlayPage } from "./pages/play";
import { ProgressPage } from "./pages/progress";
import { SessionPage } from "./pages/session";
import { SettingsPage } from "./pages/settings";
import { Icon, type IconName } from "./ui/Icon";

type AuthState = { user: User | null; offline: boolean; ready: boolean; setUser: (user: User | null) => void };
const AuthContext = createContext<AuthState | null>(null);
export const useAuth = () => useContext(AuthContext)!;

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then((response) => setUser(response.user))
      .catch((error) => setOffline(error instanceof ApiError && error.status === 0))
      .finally(() => setReady(true));
  }, []);
  return <AuthContext.Provider value={{ user, offline, ready, setUser }}>{children}</AuthContext.Provider>;
}

function RequireAuth() {
  const { user, offline, ready } = useAuth();
  if (!ready) return <main className="page"><Loading /></main>;
  if (offline) return <OfflinePage />;
  if (!user) {
    exitChildMode();
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Keeps a child in Ruang Anak until a caregiver deliberately leaves it. */
function CaregiverSpace() {
  const childId = getChildMode();
  return childId ? <Navigate to={`/play/${childId}`} replace /> : <Outlet />;
}

export const useChild = () => useOutletContext<{ child: Child; reloadChild: () => void }>();

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "", label: "Hari ini", icon: "home", end: true },
  { to: "progress", label: "Progres", icon: "steps" },
  { to: "materials", label: "Materi", icon: "library" },
  { to: "settings", label: "Profil", icon: "user" },
];

function ChildSwitcher({ current }: { current: Child }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useLoad(() => api<{ children: Child[] }>("/children"), [current.id, current.nickname]);
  const children = data?.children ?? [current];
  return (
    <label className="switcher">
      <span className="sr-only">Pilih anak</span>
      <select
        value={current.id}
        onChange={(event) => {
          if (event.target.value === "new") navigate("/children/new");
          else navigate(pathname.replace(current.id, event.target.value));
        }}
      >
        {children.map((child) => <option key={child.id} value={child.id}>{child.nickname}{child.isSample ? " (contoh)" : ""}</option>)}
        <option value="new">Tambah anak</option>
      </select>
    </label>
  );
}

function ChildLayout() {
  const { childId } = useParams();
  const { data, error, loading, reload } = useLoad(() => api<{ child: Child }>(`/children/${childId}`), [childId]);
  if (loading && !data) return <main className="page"><Loading /></main>;
  if (!data) return <main className="page narrow"><ErrorNotice error={error} /><NavLink className="button quiet" to="/">Kembali ke daftar anak</NavLink></main>;
  const base = `/children/${childId}`;
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="LangkahBelajar, daftar anak"><img src="/icon.svg" alt="" width="32" height="32" /> LangkahBelajar</NavLink>
        <ChildSwitcher current={data.child} />
      </header>
      <nav className="tabs" aria-label="Menu utama">
        {NAV.map((item) => (
          <NavLink key={item.label} end={item.end} to={item.to ? `${base}/${item.to}` : base}>
            <Icon name={item.icon} /> <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="page">
        <Outlet context={{ child: data.child, reloadChild: reload }} />
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <VoiceNotice />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="play/:childId" element={<PlayPage />} />
            <Route path="sessions/:sessionId" element={<SessionPage />} />
            <Route element={<CaregiverSpace />}>
              <Route index element={<ChildrenPage />} />
              <Route path="children/new" element={<NewChildPage />} />
              <Route path="children/:childId" element={<ChildLayout />}>
                <Route index element={<HomePage />} />
                <Route path="starter" element={<StarterPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="materials" element={<MaterialsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
