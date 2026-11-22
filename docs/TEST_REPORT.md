# Test Report

**Run date:** 2026-11-22, after the Engklek redesign and built-in audio player
**Environment:** Windows 11, Node.js 24.15.0, PostgreSQL 18.4, Microsoft Edge through Playwright

## Summary

| Check | Command | Result |
|---|---|---|
| Type checking | `npm run typecheck` | **PASS** |
| Linting | `npm run lint` | **PASS** |
| Production build | `npm run build` | **PASS** |
| Domain rules and REST API | `npm test -w @langkahbelajar/api` | **PASS** (51 of 51), see known issue |
| Integration service and ACL | `npm test -w @langkahbelajar/integration` | **PASS** (15 of 15) |
| Browser journeys, desktop and mobile | `npm run test:e2e` | **PASS** (22 of 22) |
| Built-in clip plays on a device with only English voices | Included in E2E, using a silent test clip | **PASS** |
| Built-in clip plays offline through the service worker | Scripted browser check, using a silent test clip | **PASS** |
| Real Indonesian audio | `npm run audio:sync` | **BLOCKED**, 0 of 73 clips supplied |
| Automated accessibility (axe, serious and critical) | Included in E2E, 14 screens at 2 sizes | **PASS** |
| Responsive layout, 23 screen states at 21 sizes from 320px to 2560px, including landscape phones and tablets | Scripted browser emulation, 483 checks | **PASS** |
| Worst-case data at 320px with the largest text | Scripted stress run | **PASS** |
| Production API soak | 2,505 full learning journeys | **PASS**, no server crash |
| Docker images and Compose | `docker compose up` | **BLOCKED**, Docker is not installed |
| Real partner provider | | **BLOCKED**, no partner agreed |
| Screen reader and physical devices | Manual | **NOT RUN** |
| Evaluation with educators | Manual | **NOT RUN** |

## Known issue

The Vitest process for the core API sometimes dies with a native crash on Windows with Node 24 (exit `0xC0000409` or a segmentation fault). It happened in roughly 1 of 6 to 1 of 18 runs, at a different test each time, and never as an assertion failure. The root cause is not identified.

`apps/api/test/run.mjs` reruns once after a native crash and prints a warning. Real test failures are not retried. The production server did not crash during the soak run.

## Test policy coverage

| Area | Scenario | Result |
|---|---|---|
| Authentication | Valid login succeeds, invalid credentials are rejected | PASS |
| Authentication | Protected routes need a session, expired sessions are rejected | PASS |
| Child data | A caregiver sees only related children | PASS |
| Child data | Another caregiver is denied on all 22 child and session calls | PASS |
| Child data | Diagnosis fields are rejected | PASS |
| Child space | Back button and direct links cannot reach caregiver pages | PASS |
| Child space | A short press does not exit, a 2-second hold does, and a typed alternative works | PASS |
| Sessions | Create, pause, resume, stop, and complete | PASS |
| Sessions | The same `idempotency_key` does not duplicate progress, including 5 concurrent requests | PASS |
| Sessions | State is saved on stop and resumes at the same step | PASS |
| Sessions | Profile changes do not alter a running session | PASS |
| Sessions | Answer rules never reach the client | PASS |
| Practice | Ordering works by tap, drag, and buttons | PASS |
| Practice | Objects can be counted one by one | PASS |
| Practice | A wrong answer offers a gentle retry | PASS |
| Mastery | Two independent sessions trigger a recommendation | PASS |
| Mastery | Two successes in one session count once | PASS |
| Mastery | Success in one skill does not raise another | PASS |
| Mastery | Pauses do not change mastery | PASS |
| Mastery | Caregiver summaries do not change results | PASS |
| Integration | Valid responses are normalized | PASS |
| Integration | Timeouts, 5xx, and rate limits do not crash the app | PASS |
| Integration | Empty data shows a fallback | PASS |
| Integration | Child data is not sent to providers | PASS |
| Offline | Stored materials remain available with the browser offline | PASS |
| Offline | Expired stored items are not served | PASS |

## Reproduce

```powershell
npm run db:start
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```
