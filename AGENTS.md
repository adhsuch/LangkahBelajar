# LangkahBelajar Development Rules

Read `docs/DEVELOPMENT_STATUS.md` first. Before reporting work as done, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`, then update `docs/TEST_REPORT.md`. Use synthetic data only.

## Language

- **English:** code, identifiers, database schema, API routes and payloads, error codes, logs, comments, tests, commit messages, and technical docs in `docs/`.
- **Bahasa Indonesia:** user-facing UI text and learning content only. Keep it in UI copy or locale files, never in domain identifiers.
- **Unchanged:** the product name LangkahBelajar, course names, and the original paper `Makalah_DDD_LangkahBelajar_18224030_18224120.pdf`, which remains the source of truth for product scope.

## DDD glossary

Use the English term in development. The Indonesian term is the one used in the paper.

| Paper (Indonesian) | Development (English) | Kind |
|---|---|---|
| BC Pembelajaran Bertahap | Stepwise Learning | Core bounded context |
| BC Profil Belajar | Learning Profile | Supporting bounded context |
| BC Pendampingan | Caregiver Support | Supporting bounded context |
| BC Identitas dan Akses | Identity and Access | Generic bounded context |
| BC Katalog Materi | Material Catalog | External bounded context |
| BC Bank Aktivitas | Activity Bank | External bounded context |
| Penyedia Materi | Material Provider | External upstream |
| Penyedia Aktivitas | Activity Provider | External upstream |
| SesiBelajar | `LearningSession` | Entity |
| LangkahSesi | `SessionStep` | Entity |
| HasilLatihan | `ExerciseResult` | Entity |
| PenguasaanKemampuan | `SkillMastery` | Entity |
| SesiDiselesaikan | `SessionCompleted` | Domain event |
| Pendamping | Caregiver | Role |
| Anak | Child | Role |
| Kemampuan | Skill | Domain term |
| Membaca, menulis, berhitung | Reading, writing, counting | Skills |
| Mengikuti instruksi | Following instructions | Skill |
| Keterlibatan dan rutinitas | Engagement and routine | Skills |
| Bantuan | Support | Domain term |
| Keberhasilan mandiri | Independent success | Domain term |
| Rutinitas, jadwal | Routine, schedule | Domain terms |
| Catatan pendamping | Caregiver note | Domain term |
