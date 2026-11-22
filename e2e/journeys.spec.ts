import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const setSim = (mode: string) => fetch(`http://127.0.0.1:4301/__sim/failure/${mode}`, { method: "POST" });

test.beforeEach(() => setSim("none"));

async function registerWithChild(page: Page, nickname = "Anak Contoh") {
  await page.goto("/register");
  await page.getByLabel("Nama Anda").fill("Pendamping Contoh");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("sample-password-123");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await page.getByRole("link", { name: "Buat profil anak" }).click();
  await page.getByLabel("Nama panggilan").fill(nickname);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("complementary", { name: "Pratinjau tampilan anak" })).toBeVisible();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: /Langsung ke beranda/ }).click();
  await expect(page).toHaveURL(/\/children\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `${nickname} siap melangkah` })).toBeVisible();
  return page.url().split("/children/")[1]!;
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function answerCurrent(page: Page) {
  await page.getByRole("group", { name: "Bantuan" }).waitFor();
  const heading = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  const known: Record<string, string> = { "Pilih huruf A.": "A", "Pilih huruf M.": "M", "Pilih huruf S.": "S", "Ada berapa apel?": "3", "Ada berapa bintang?": "4", "Ada berapa bola?": "2" };
  await page.getByRole("button", { name: known[heading], exact: true }).click();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
}

async function leaveChildSpace(page: Page) {
  await page.getByRole("button", { name: /Keluar, khusus/ }).click();
  await page.getByLabel("Ketik KELUAR").fill("KELUAR");
  await page.getByRole("button", { name: "Kembali ke Ruang Pendamping" }).click();
  await expect(page).toHaveURL(/\/children\//);
}

test("caregiver and child complete a session, then review progress", async ({ page }) => {
  await registerWithChild(page);
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Mulai sesi belajar" }).click();
  await expect(page.getByRole("heading", { name: "Hari ini kita akan" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Mulai", exact: true }).click();

  await answerCurrent(page);
  await page.getByRole("group", { name: "Bantuan" }).waitFor();
  await page.getByRole("button", { name: "Jeda" }).click();
  await expect(page.getByRole("heading", { name: "Pipit menunggu di sini" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await answerCurrent(page);
  await page.getByRole("button", { name: "Lanjut belajar" }).click();
  for (;;) {
    const next = page.getByRole("button", { name: /^(Lewati|Selesaikan sesi)$/ });
    await expect(next).toBeEnabled();
    const finishing = (await next.textContent())?.includes("Selesaikan");
    await next.click();
    if (finishing) break;
    await expect(page.getByRole("button", { name: "Lewati" })).toBeHidden({ timeout: 200 }).catch(() => undefined);
  }
  await expect(page.getByRole("heading", { name: "Sesi selesai" })).toBeVisible();

  await page.getByRole("button", { name: "Ke peta" }).click();
  await page.getByRole("button", { name: "Ayo mulai" }).waitFor();
  await leaveChildSpace(page);
  await page.getByRole("link", { name: "Progres", exact: true }).click();
  await expect(page.getByText("1 dari 2 sesi berhasil").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ringkasan sesi" })).toBeVisible();
  await page.getByRole("button", { name: "Lihat riwayat dan catatan" }).first().click();
  await page.getByLabel("Tambah catatan").fill("Lebih nyaman memakai suara.");
  await page.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(page.getByText("Lebih nyaman memakai suara.")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("a child cannot reach the caregiver space without the exit gate", async ({ page }) => {
  const childId = await registerWithChild(page);
  await page.getByRole("link", { name: "Buka Ruang Anak" }).click();
  await page.getByRole("button", { name: "Ayo mulai" }).waitFor();
  await expect(page.getByRole("link", { name: "Profil" })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/play/${childId}`));
  await page.goto(`/children/${childId}/settings`);
  await expect(page).toHaveURL(new RegExp(`/play/${childId}`));

  const exit = page.getByRole("button", { name: /Keluar, khusus/ });
  await exit.waitFor();
  const box = (await exit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect(page).toHaveURL(new RegExp(`/play/${childId}`));
  await page.getByRole("button", { name: "Tutup" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page).toHaveURL(new RegExp(`/children/${childId}$`), { timeout: 4000 });
  await page.mouse.up();
});

test("ordering works by tap, drag, and buttons, and a wrong answer stays gentle", async ({ page }) => {
  const childId = await registerWithChild(page);
  const updated = await page.request.patch(`/api/children/${childId}/learning-profile`, { data: { targets: ["ROUTINE"] } });
  expect(updated.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Mulai sesi belajar" }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.getByRole("group", { name: "Bantuan" }).waitFor();

  const tray = page.locator(".order > .choices");
  for (const item of ["Selesai", "Latihan", "Mulai", "Istirahat"]) await tray.getByRole("button", { name: item, exact: true }).click();
  await page.getByRole("button", { name: "Kirim urutan" }).click();
  await expect(page.getByRole("heading", { name: "Coba lagi, yuk" })).toBeVisible();
  await page.getByRole("button", { name: "Coba lagi" }).click();

  for (const item of ["Latihan", "Mulai", "Selesai", "Istirahat"]) await tray.getByRole("button", { name: item, exact: true }).click();
  await page.getByRole("button", { name: "Naikkan Mulai" }).click();
  await page.getByRole("button", { name: "Naikkan Istirahat" }).click();
  const rows = page.locator(".order-row");
  await expect(rows).toHaveText([/Mulai/, /Latihan/, /Istirahat/, /Selesai/]);

  const grip = rows.nth(0).locator(".order-grip");
  const from = (await grip.boundingBox())!;
  const to = (await rows.nth(1).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(rows).toHaveText([/Latihan/, /Mulai/, /Istirahat/, /Selesai/]);
  await page.getByRole("button", { name: "Naikkan Mulai" }).click();
  await page.getByRole("button", { name: "Kirim urutan" }).click();
  await expect(page.getByRole("heading", { name: "Bagus, satu langkah lagi!" })).toBeVisible();
});

test("counting objects can be touched one by one", async ({ page }) => {
  const childId = await registerWithChild(page);
  await page.request.patch(`/api/children/${childId}/learning-profile`, { data: { targets: ["COUNTING"] } });
  await page.reload();
  await page.getByRole("button", { name: "Mulai sesi belajar" }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  const objects = page.locator(".count-object");
  await expect(objects.first()).toBeVisible();
  await objects.nth(0).click();
  await objects.nth(1).click();
  await expect(page.getByText("Sudah dihitung: 2")).toBeVisible();
  await objects.nth(1).click();
  await expect(page.getByText("Sudah dihitung: 1")).toBeVisible();
});

test("key screens have no serious accessibility violations", async ({ page }) => {
  const check = async (name: string) => {
    // Contrast is only meaningful once fade-ins have finished.
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${name}: ${item.id} (${item.nodes.length})`);
    expect(serious).toEqual([]);
  };
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk" }).waitFor();
  await check("login");
  await page.goto("/register");
  await page.getByLabel("Nama Anda").fill("Pendamping Contoh");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("sample-password-123");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await page.getByRole("link", { name: "Buat profil anak" }).waitFor();
  await check("welcome");
  await page.getByRole("link", { name: "Buat profil anak" }).click();
  await page.getByLabel("Nama panggilan").fill("Anak Contoh");
  await check("setup name");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("checkbox", { name: /Membaca/ }).waitFor({ state: "attached" });
  await check("setup skills");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("complementary", { name: "Pratinjau tampilan anak" }).waitFor();
  await check("setup preview");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: /Langsung ke beranda/ }).click();
  await page.getByText(/Pukul/).waitFor();
  await check("home");
  await page.getByRole("button", { name: "Ubah" }).click();
  await page.getByRole("button", { name: "Simpan jadwal" }).waitFor();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await check("schedule sheet");
  await page.getByRole("button", { name: "Tutup" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Buka Ruang Anak" }).click();
  await page.getByRole("button", { name: "Ayo mulai" }).waitFor();
  await check("child map");
  await page.getByRole("button", { name: "Ayo mulai" }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).waitFor();
  await check("overview");
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.getByRole("group", { name: "Bantuan" }).waitFor();
  await check("practice");
  await page.getByRole("button", { name: "Jeda" }).click();
  await page.getByRole("button", { name: "Lanjutkan" }).waitFor();
  await check("paused");
  await leaveChildSpace(page);
  await page.getByRole("link", { name: "Progres", exact: true }).click();
  await page.getByRole("heading", { name: "Ringkasan sesi" }).waitFor();
  await check("progress");
  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Simpan profil" }).waitFor();
  await check("settings");
  await page.getByRole("link", { name: "Materi", exact: true }).click();
  await page.getByText(/Tersimpan:/).waitFor();
  await check("materials");
});

test("key screens fit phone, tablet, laptop, and desktop", async ({ page }) => {
  const sizes = [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]] as const;
  const fits = async (name: string) => {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      expect(await noHorizontalScroll(page), `${name} at ${width}x${height}`).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  };
  const childId = await registerWithChild(page);
  await page.getByText(/Pukul/).waitFor();
  await fits("home");
  for (const [path, heading] of [["progress", "Ringkasan sesi"], ["materials", "Materi tersimpan"], ["settings", "Profil"]] as const) {
    await page.goto(`/children/${childId}/${path}`);
    await page.getByRole("heading", { name: heading }).first().waitFor();
    await fits(path);
  }
  await page.goto(`/children/${childId}`);
  await page.getByRole("link", { name: "Buka Ruang Anak" }).click();
  await page.getByRole("button", { name: "Ayo mulai" }).waitFor();
  await fits("child map");
  await page.getByRole("button", { name: "Ayo mulai" }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).waitFor();
  await fits("overview");
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.getByRole("group", { name: "Bantuan" }).waitFor();
  await fits("practice");
});

const stubVoices = (page: Page, voices: { name: string; lang: string }[]) =>
  page.addInitScript((list) => {
    const spoken: { text: string; voice?: string; lang?: string }[] = [];
    Object.assign(window, { __spoken: spoken });
    const available = list.map((voice) => ({ ...voice, localService: true, default: false }));
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { voice?: { name: string }; lang?: string; rate = 1; constructor(public text: string) {} } });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => available,
        cancel: () => undefined,
        speak: (utterance: { text: string; voice?: { name: string }; lang?: string }) => spoken.push({ text: utterance.text, voice: utterance.voice?.name, lang: utterance.lang }),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  }, voices);

const openPractice = async (page: Page) => {
  await registerWithChild(page);
  await page.getByRole("button", { name: "Mulai sesi belajar" }).click();
  await page.getByRole("button", { name: "Mulai", exact: true }).click();
  await page.getByRole("group", { name: "Bantuan" }).waitFor();
};

test("instructions are spoken with the Indonesian voice", async ({ page }) => {
  await stubVoices(page, [{ name: "English Voice", lang: "en-US" }, { name: "Suara Indonesia", lang: "id-ID" }]);
  await openPractice(page);
  await page.getByRole("button", { name: "Dengar instruksi" }).click();
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { voice: string; lang: string }[] }).__spoken);
  expect(spoken).toHaveLength(1);
  expect(spoken[0]).toMatchObject({ voice: "Suara Indonesia", lang: "id-ID" });
});

test("an English voice is never used when no Indonesian voice exists", async ({ page }) => {
  await stubVoices(page, [{ name: "English Voice", lang: "en-US" }]);
  await openPractice(page);
  await page.getByRole("button", { name: "Dengar instruksi" }).click();
  await expect(page.getByText("Audio bahasa Indonesia untuk bagian ini belum tersedia.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken)).toHaveLength(0);
});

test.describe("built-in audio", () => {
  test.use({ serviceWorkers: "block" });

  test("plays the app's Indonesian clip on a device with only English voices", async ({ page }) => {
    await stubVoices(page, [{ name: "English Voice", lang: "en-US" }]);
    await page.addInitScript(() => {
      const played: { src: string; ok: boolean }[] = [];
      Object.assign(window, { __played: played });
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const entry = { src: this.src, ok: false };
        played.push(entry);
        const started = play.call(this);
        void started.then(() => (entry.ok = true)).catch(() => undefined);
        return started;
      };
    });
    const samples = 800;
    const wav = Buffer.alloc(44 + samples);
    wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write("data", 36); wav.writeUInt32LE(samples, 40); wav.fill(128, 44);
    await page.route("**/audio/id/manifest.json", (route) => route.fulfill({ json: { total: 1, clips: { "Pilih huruf A": "/audio/id/test-clip.wav?v=1" } } }));
    await page.route("**/audio/id/test-clip.wav*", (route) => route.fulfill({ contentType: "audio/wav", body: wav }));
    await openPractice(page);
    await expect(page.getByRole("heading", { name: "Pilih huruf A." })).toBeVisible();
    await page.getByRole("button", { name: "Dengar instruksi" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __played: { src: string; ok: boolean }[] }).__played[0]?.ok)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __played: { src: string }[] }).__played[0]?.src)).toContain("/audio/id/test-clip.wav");
    expect(await page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken)).toHaveLength(0);
    await expect(page.getByText("Audio bahasa Indonesia untuk bagian ini belum tersedia.")).toBeHidden();
  });
});

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/children/00000000-0000-4000-8000-000000000000/progress");
  await expect(page).toHaveURL(/\/login$/);
});

test("a provider outage shows a clear message and stored materials stay available offline", async ({ page, context }) => {
  const childId = await registerWithChild(page);
  const created = await page.request.post(`/api/children/${childId}/sessions`, { data: {} });
  expect(created.status()).toBe(201);
  const { session } = await created.json();
  await page.request.patch(`/api/sessions/${session.id}/stop`);
  await page.getByRole("link", { name: "Materi", exact: true }).click();
  await expect(page.getByText("Penyedia materi dan aktivitas terhubung.")).toBeVisible();

  await setSim("error");
  const fallback = await page.request.post(`/api/children/${childId}/sessions`, { data: {} });
  expect(fallback.status()).toBe(201);
  await page.request.patch(`/api/sessions/${(await fallback.json()).session.id}/stop`);
  await page.reload();
  await expect(page.getByText("Penyedia belum bisa dihubungi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Membaca" })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole("button", { name: "Membaca" })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sedang tidak terhubung" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Membaca" })).toBeVisible();
  await context.setOffline(false);
});
