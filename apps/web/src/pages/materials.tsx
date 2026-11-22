import { SKILL_CODES, type Material, type SkillCode } from "@langkahbelajar/shared";
import { useState } from "react";
import { api, useLoad } from "../api";
import { ErrorNotice, Loading, MaterialView, Notice } from "../components";
import { SKILL_LABELS } from "../copy";
import { Icon, SKILL_ICONS } from "../ui/Icon";

interface Status {
  integration: { reachable: boolean; providers?: { name: string; lastError: string | null; rateLimitedUntil: string | null }[] };
  storedItems: { materials: number; activities: number };
}

const FORMAT_LABELS = { TEXT: "Bacaan", VISUAL: "Gambar", AUDIO: "Suara" };

function MaterialLibrary({ materials }: { materials: Material[] }) {
  const [filter, setFilter] = useState<SkillCode | null>(null);
  if (materials.length === 0) {
    return (
      <div className="empty">
        <p>Belum ada materi tersimpan. Mulai satu sesi saat terhubung, dan materinya akan tersedia di sini.</p>
      </div>
    );
  }
  const skills = SKILL_CODES.filter((code) => materials.some((item) => item.skillCode === code));
  const visible = materials.filter((item) => !filter || item.skillCode === filter).sort((a, b) => a.skillCode.localeCompare(b.skillCode) || a.level - b.level || a.format.localeCompare(b.format));
  return (
    <>
      <div className="filters" role="group" aria-label="Saring materi">
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>Semua</button>
        {skills.map((code) => (
          <button type="button" key={code} aria-pressed={filter === code} onClick={() => setFilter(code)}><Icon name={SKILL_ICONS[code]} size={18} /> {SKILL_LABELS[code]}</button>
        ))}
      </div>
      <ul className="library">
        {visible.map((item) => (
          <li key={`${item.materialId}-${item.version}`} className="panel">
            <h2>{item.title}</h2>
            <p className="muted">{SKILL_LABELS[item.skillCode]}, tahap {item.level}, {FORMAT_LABELS[item.format]}</p>
            <MaterialView material={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function MaterialsPage() {
  const status = useLoad(() => api<Status>("/integrations/status"), []);
  const stored = useLoad(() => api<{ materials: Material[] }>("/materials/stored"), []);
  const providers = status.data?.integration.providers ?? [];
  const problem = status.data && (!status.data.integration.reachable || providers.some((provider) => provider.lastError));

  return (
    <div className="stack">
      <h1>Materi tersimpan</h1>
      {status.error ? <Notice tone="warn">Status koneksi belum bisa diperiksa. Materi tersimpan tetap dapat dibuka.</Notice> : null}
      {status.data && !problem && (
        <div className="connection good" role="status"><Icon name="online" /> <span><strong>Penyedia materi dan aktivitas terhubung.</strong> Materi baru akan diperbarui otomatis.</span></div>
      )}
      {problem && (
        <div className="connection warn" role="alert"><Icon name="offline" /> <span><strong>Penyedia belum bisa dihubungi.</strong> Aplikasi memakai materi tersimpan, dan progres tetap aman.</span></div>
      )}
      {status.data && <p className="muted">Tersimpan: {status.data.storedItems.materials} materi dan {status.data.storedItems.activities} aktivitas.</p>}
      <ErrorNotice error={stored.error} />
      {stored.loading && !stored.data && <Loading />}
      {stored.data && <MaterialLibrary materials={stored.data.materials} />}
    </div>
  );
}

/** Shown when the server cannot be reached at all. It reads only the catalog copy in the browser cache. */
export function OfflinePage() {
  const stored = useLoad(() => api<{ materials: Material[] }>("/materials/stored"), []);
  return (
    <main className="page page-full stack">
      <p className="auth-brand dark"><img src="/icon.svg" alt="" width="32" height="32" /> LangkahBelajar</p>
      <h1>Sedang tidak terhubung</h1>
      <div className="connection warn" role="alert"><Icon name="offline" /> <span>Materi tersimpan masih bisa dibuka. Sesi dan progres tersedia lagi setelah koneksi kembali.</span></div>
      <button className="button quiet" onClick={() => window.location.reload()}><Icon name="retry" size={20} /> Coba hubungkan lagi</button>
      {stored.loading && !stored.data && <Loading />}
      {stored.error ? <p>Belum ada materi tersimpan di perangkat ini.</p> : null}
      {stored.data && <MaterialLibrary materials={stored.data.materials} />}
    </main>
  );
}
