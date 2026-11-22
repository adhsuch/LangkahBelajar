# Development Status

Last updated: 2026-11-22

| Phase | Status |
|---|---|
| 00 Repository audit and architecture | Done |
| 01 Foundation | Done |
| 02 Child profiles and targets | Done |
| 03 Sessions and practice modules | Done |
| 04 Mastery and progress | Done |
| 05 Material and activity integration | Done against simulated providers |
| 06 Caregiver support and routines | Done, reminders are in-app only |
| 07 Integration and API hardening | Done |
| 08 UI/UX and accessibility polish | Done, automated checks only |
| 09 Final quality assurance | Passed locally, physical STB and public HTTPS pending |
| UI redesign (Engklek) | Done, see [DESIGN.md](DESIGN.md) |
| Built-in Indonesian audio | Player and offline cache done, 0 of 73 clips supplied |

## Open items

- **Audio clips are missing.** The app needs the 73 clips listed in `docs/AUDIO_SCRIPT.csv`. Until then, speech works only on devices with an Indonesian voice.

0. **Intermittent native crash in the API test process** on Windows with Node 24. The root cause is unknown, and the test runner reruns once. See [TEST_REPORT.md](TEST_REPORT.md).

1. **STB deployment is pending.** The core stack was built and smoke-tested on Fedora with rootless Podman and Docker Compose. The physical STB, external integration deployment and public Cloudflare endpoint still need verification.
2. **No partner yet.** Partner groups and contracts are undecided, so both providers are simulated behind real HTTP adapters.
3. **STB hardware is unconfirmed.** Prisma needs a 64-bit STB.
4. **Dependency advisory.** `npm audit` reports 4 high findings in `deepmerge-ts` and `effect`, pulled in by the Prisma 6 CLI config package. The fix is a breaking move to Prisma 7. The CLI runs only for migrations and does not process user input, so the upgrade was deferred.
5. **Accessibility needs people.** Automated checks pass, but screen readers, real devices, and the Indonesian text-to-speech voice have not been tested. Educators still need to evaluate the design.

## Known limits

- The client is a responsive installable PWA, not a native mobile app.
- Starting a session and saving answers need a connection to the STB. Offline mode covers stored materials only.
- Reminders appear on the home screen. Push delivery is not built.
- Speech plays the app's own clips first. New provider text without a clip uses a device voice only if it is Indonesian, and otherwise shows a message.
- The integration service's own cache is in memory. The durable copy is in the core database.
- Login rate limiting is per process, which fits the single STB instance.

## Decisions

- Development is in English, and the UI stays in Bahasa Indonesia.
- The integration service is separate from the core, following Figure 1 of the paper.
- Unrelated caregivers receive `404` rather than `403`.
- Starter activities never count toward mastery.
- A skipped step is recorded as skipped, not as a failure.
- Caregivers and children use separate spaces. Leaving Ruang Anak takes a 2-second hold or typing KELUAR.
- Session activities follow a fixed skill order, so the routine stays predictable.
- Gentle motion is on by default for new profiles. "Tampilan tenang" and the OS reduced-motion setting turn it off.
- Counting objects and pictures named in an instruction always show, because they are the question rather than an optional cue.
