# Course Deliverables

One application serves both courses.

## PAWM (II3140)

| Requirement | Where |
|---|---|
| Responsive frontend | `apps/web`, tested at 1280 px and 375 px |
| Main navigation | `apps/web/src/App.tsx` |
| Authentication flow | `apps/web/src/pages/auth.tsx`, `apps/api/src/contexts/identity` |
| Child profiles and guided setup | `apps/web/src/pages/children.tsx`, `settings.tsx` |
| Child space and journey map | `apps/web/src/pages/play.tsx` |
| Learning sessions | `apps/web/src/pages/session.tsx`, `practice.tsx` |
| Design system | [DESIGN.md](DESIGN.md), `apps/web/src/styles.css`, `apps/web/src/ui` |
| Progress | `apps/web/src/pages/progress.tsx` |
| Persistent database | `apps/api/prisma` |
| Journey evidence | `e2e/journeys.spec.ts` |

**Demo script:** register, follow the guided profile setup and try the live preview, start a session, answer, pause, reload, resume, and finish. Then hold the exit button for 2 seconds, open Progres, and add a note.

## TST (II3160)

| Requirement | Where |
|---|---|
| System architecture diagram | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Bounded-context mapping | [DDD.md](DDD.md) |
| REST API specification | [API_SPEC.md](API_SPEC.md) |
| Proposed external contracts | [API_SPEC.md](API_SPEC.md#proposed-provider-contract) |
| Adapter and ACL | `apps/integration/src/provider-client.ts`, `acl.ts` |
| Data transformation examples | [API_SPEC.md](API_SPEC.md#data-transformation-example) |
| Error-handling strategy | [ARCHITECTURE.md](ARCHITECTURE.md#error-handling) |
| Integration test evidence | `apps/integration/test`, [TEST_REPORT.md](TEST_REPORT.md) |
| Docker on the STB | `docker-compose.yml`, `Dockerfile.api` |
| Service outside the STB | `docker-compose.integration.yml`, `Dockerfile.service` |

**Failure drill:** with `npm run dev` running, simulate an outage, then open Materi to see the fallback:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:4200/__sim/failure/error
```

Restore it with:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:4200/__sim/failure/none
```

Other modes are `timeout`, `rate_limit`, and `empty`.
