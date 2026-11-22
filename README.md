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

Copy `.env.docker.example` to `.env.docker` and replace every value.

Outside the STB:

```powershell
docker compose -f docker-compose.integration.yml --env-file .env.docker up -d --build
```

On the STB:

```powershell
docker compose --env-file .env.docker up -d --build
```

The STB must be 64-bit (x86-64 or ARM64) because Prisma has no 32-bit engine. The Docker setup has not been run yet, see [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

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
