# LangkahBelajar

A stepwise learning companion for elementary school children with ADHD, dyslexia, and autism. Children practice reading, writing, counting, following instructions, engagement, and routines. A parent or teacher sets targets and reviews progress.

Built for II3140 (PAWM) and II3160 (TST) by Ibrahim Ferizarizqi Permana (18224120) and Adham Sachadeva Purwadi (18224030).

> LangkahBelajar is a learning-support design that still needs evaluation with educators. It is not a diagnostic tool and does not replace therapy. Use synthetic data only.

## Run locally

Requires Node.js 22 or newer and PostgreSQL binaries (version 18 is detected automatically on Windows). Docker is not needed for local development.

```powershell
npm install
npm run setup
npm run dev
```

Open <http://127.0.0.1:5173> and register a caregiver account.

`npm run setup` creates the `.env` files, starts a project-local PostgreSQL cluster on port 55432, applies migrations, and seeds reference data. It does not touch any other PostgreSQL server on the machine. After a restart, run `npm run db:start` before `npm run dev`.

To add the synthetic demo caregiver (`pendamping.contoh@example.test`), choose a password and seed again:

```powershell
$env:SEED_DEMO_PASSWORD = "choose-a-demo-password"; npm run db:seed
```

## Services

| Service | Port | Deployed |
|---|---|---|
| Web app (dev server) | 5173 | Separate from the STB |
| Core API (`apps/api`) | 4000 | STB |
| PostgreSQL | 55432 locally | STB |
| Integration service (`apps/integration`) | 4100 | Outside the STB |
| Simulated providers (`apps/provider-sim`) | 4200 | Outside the STB, until partners exist |

## Quality checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` needs a fresh `npm run build`. It uses Microsoft Edge by default. Set `E2E_BROWSER_CHANNEL=chrome` to use Chrome.

## STB architecture

`HTTPS client → Cloudflare Tunnel → Nginx gateway → Core API → PostgreSQL`

The Armbian STB runs PostgreSQL, the core API, Nginx, and the Cloudflare connector on a private Compose bridge. The connector makes an outbound connection, so the router needs no port forwarding. The database uses the `db-data` volume and has no published port. The core API calls the integration service on a separate host. Host the web frontend separately and route its `/api` path to the API origin if it needs same-origin browser sessions.

## Deploy with Docker

Confirm the architecture and available memory on the STB:

```sh
uname -m
free -h
df -h
docker compose version
```

Use a 64-bit Armbian host (`aarch64` or `x86_64`). The four container limits total 704 MiB and 1.5 CPU. Allow additional memory for Armbian, Docker, and temporary build usage.

On each host, create a private `.env` from `.env.example` with `umask 077`. For an existing installation, keep its database password and volume, and migrate values from `.env.docker` into `.env`. Set these values locally:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | Existing database password, or a new URL-safe random password for a new stack |
| `INTEGRATION_URL` | URL of the integration service, reachable from the STB |
| `INTEGRATION_API_KEY` | Same strong key on the core and integration hosts |
| `TUNNEL_TOKEN` | Connector token from the group's Cloudflare dashboard, required for public deployment |
| `COOKIE_SECURE` | `false` for local HTTP testing, `true` for public HTTPS |
| `TRUST_PROXY_HOPS` | `1`, for the Nginx hop in this Compose stack |
| `WEB_ORIGIN` | Optional exact HTTPS origin of a same-site browser frontend |

For browser sessions, prefer a same-origin API proxy. An allowlisted HTTPS origin can send credentialed requests across origins within the same site. Use `credentials: "include"` in that frontend. Session cookies are `SameSite=Strict`, so an unrelated website needs its own same-origin API proxy for cookie sessions.

On the integration host outside the STB:

```sh
docker compose -f docker-compose.integration.yml up -d --build
```

On the STB, back up existing data before updating a stack with a database. Keep the dump on private storage.

```sh
umask 077
docker compose exec -T db pg_dump -Fc -U langkah -d langkahbelajar > langkahbelajar.dump
test -s langkahbelajar.dump
docker compose exec -T db pg_restore --list < langkahbelajar.dump
```

For a fresh install, start with the commands below. The API applies Prisma migrations at startup.

```sh
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
docker stats --no-stream
curl -i http://127.0.0.1:8080/api/health
```

In the Cloudflare dashboard, assign the group hostname under `stei.fun` (K01) or `stei.site` (K02). Set the service type to HTTP and the URL to `http://gateway:80`. Set the token and `COOKIE_SECURE=true` in the STB's `.env`, then enable the public profile.

```sh
docker compose --profile public up -d --build --wait
docker compose --profile public ps
docker compose --profile public logs --tail=20 tunnel
curl -i "https://<group-domain>/api/health"
```

The expected response is HTTP 200 with `{"status":"ok"}`. Replace `<group-domain>` with the real assigned hostname. For the submission, record that tested service URL, the [GitHub repository](https://github.com/adhsuch/LangkahBelajar), and `README.pdf`. See the [test report](docs/TEST_REPORT.md) for verified environments.

## API access and endpoints

The health endpoint is public. Use a synthetic caregiver account for application routes. Registration or login issues the `lb_session` cookie. To access another caregiver's child profile, the profile owner must grant access. For partner integrations, request a `skills:read` key from the LangkahBelajar team and send it as `X-API-Key`. The partner key reads skill metadata.

| Endpoint group | Routes under `/api` |
|---|---|
| Health and partner access | `GET /health`, `GET /partner/skills` |
| Account | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/password`; `GET/PATCH /auth/me` |
| Children and skills | `GET/POST /children`, `GET/PATCH /children/:id`, `GET /skills`, `GET /children/:id/skills` |
| Profiles and caregivers | `GET/PATCH /children/:id/learning-profile`, `POST /children/:id/caregivers` |
| Sessions | `POST /children/:id/sessions`, `GET /children/:id/sessions/resumable`, `GET /sessions/:id` |
| Session actions | `PATCH /sessions/:id/{start,pause,resume,stop}`, `POST /sessions/:id/steps/:stepId/{results,advance}` |
| Progress | `GET /children/:id/progress`, `GET /children/:id/progress/:skillCode`, `POST /children/:id/progress/:skillCode/review` |
| Caregiver support | `GET/PATCH /children/:id/routines`, `GET/POST /children/:id/notes`, `GET /children/:id/summaries` |
| Materials and integration | `GET /materials`, `GET /materials/stored`, `GET /activities`, `GET /integrations/status` |

### Example requests

Set `BASE_URL` to `http://127.0.0.1:8080` on the STB or to the assigned HTTPS origin. Use synthetic data and keep the cookie jar private.

```sh
umask 077
curl -i "$BASE_URL/api/health"
curl -fsS -c session.cookies "$BASE_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.test","displayName":"Demo","password":"example-test-password"}'
curl -fsS -b session.cookies "$BASE_URL/api/auth/me"
curl -fsS -H "X-API-Key: $PARTNER_API_KEY" "$BASE_URL/api/partner/skills"
```

See the [API specification](docs/API_SPEC.md) for payloads, authorization rules, and idempotency handling.

## Connect a partner provider

Set `MATERIAL_PROVIDER_URL`, `ACTIVITY_PROVIDER_URL`, and their API keys in the integration host’s project-root `.env` for Compose, or in `apps/integration/.env` for local npm development. The expected contract is in [docs/API_SPEC.md](docs/API_SPEC.md). If a partner's shape differs, only `apps/integration/src/acl.ts` changes.

To issue a key for another group, which can read skill metadata but no child data:

```powershell
npm run api-key:create -w @langkahbelajar/api -- partner-group-name skills:read
```

## Add Indonesian audio

The app plays its own audio files, so users do not need an Indonesian voice on their device.

1. Open `docs/AUDIO_SCRIPT.csv`. Each row has the file name, the text, and how it should be read in `read_as`.
2. Record or generate each clip and save it in `apps/web/public/audio/id` with the exact file name. MP3, M4A, and WAV are supported.
3. Link the clips into the app:

```powershell
npm run audio:sync
```

Run the same command after activity content changes, so the list stays current.

## Documentation

- [Product requirements](docs/PRD_LANGKAHBELAJAR.md)
- [Domain-driven design](docs/DDD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN.md)
- [API specification](docs/API_SPEC.md)
- [Course deliverables](docs/DELIVERABLES.md)
- [Development status](docs/DEVELOPMENT_STATUS.md)
- [Test report](docs/TEST_REPORT.md)
