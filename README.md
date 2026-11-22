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
| Web app (dev server) | 5173 | Served by the core API in production |
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

## Deploy with Docker

Create a private `.env.docker` from `.env.docker.example` on each host. Generate a URL-safe database password (for example with `openssl rand -hex 24`) and use the same strong `INTEGRATION_API_KEY` on the API and integration hosts. Set `INTEGRATION_URL` to the integration endpoint reachable from the STB.

On the integration host outside the STB, start the integration service and its simulated providers:

```sh
docker compose -f docker-compose.integration.yml --env-file .env.docker up -d --build
```

On the 64-bit STB (x86-64 or ARM64), start PostgreSQL, the core API and the Nginx gateway:

```sh
docker compose --env-file .env.docker up -d --build --wait
curl -fsS http://127.0.0.1:8080/api/health
```

The gateway's diagnostic port is bound to loopback and PostgreSQL has no published port. The web app and the integration stack run separately from the STB. See [the test report](docs/TEST_REPORT.md) for the environments verified.

For public HTTPS, configure the assigned Cloudflare hostname on `stei.fun` (K01) or `stei.site` (K02) as an HTTP route to `http://gateway:80`. Add the connector token as `TUNNEL_TOKEN` in the STB's `.env.docker` and set `COOKIE_SECURE=true`. Run these commands on the STB, then check `/api/health` on the assigned HTTPS hostname.

```sh
docker compose --env-file .env.docker --profile public up -d --build --wait
docker compose --env-file .env.docker --profile public logs --tail=20 tunnel
```

Monitor the STB with `docker stats` and back up PostgreSQL regularly:

```sh
docker compose --env-file .env.docker exec -T db pg_dump -U langkah -d langkahbelajar > langkahbelajar.sql
```

## Connect a partner provider

Set `MATERIAL_PROVIDER_URL`, `ACTIVITY_PROVIDER_URL`, and their API keys in `apps/integration/.env`. The expected contract is in [docs/API_SPEC.md](docs/API_SPEC.md). If a partner's shape differs, only `apps/integration/src/acl.ts` changes.

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
