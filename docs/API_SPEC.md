# API Specification

Base path: `/api`. Requests and responses are JSON. Private routes need the `lb_session` cookie set by register or login.

Errors use one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "fields": [{ "path": "email", "message": "..." }] } }
```

Every route that touches child data checks the caregiver-child relationship and returns `404` when it does not exist.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName }`, rate limited |
| POST | `/auth/login` | `{ email, password }`, rate limited |
| POST | `/auth/logout` | Ends the current session |
| GET | `/auth/me` | Current caregiver |
| PATCH | `/auth/me` | Added: `{ displayName }` |
| POST | `/auth/password` | Added: `{ currentPassword, newPassword }`, revokes other sessions |

## Children and learning profile

| Method | Path | Notes |
|---|---|---|
| GET, POST | `/children` | Create with `{ nickname, targets, preferences, initialNotes? }`. Extra fields such as `diagnosis` return 400 |
| GET, PATCH | `/children/:id` | `{ nickname }` |
| POST | `/children/:id/caregivers` | Added: owner shares access, `{ email, role }` |
| GET, PATCH | `/children/:id/learning-profile` | `{ preferences?, targets?, initialNotes? }` |
| GET | `/skills` | Skill codes and stages |
| GET | `/children/:id/skills` | Per-skill state |

## Sessions

| Method | Path | Notes |
|---|---|---|
| POST | `/children/:id/sessions` | `{ type?, durationMinutes?, skillCodes? }` |
| GET | `/children/:id/sessions/resumable` | Added: latest unfinished session |
| GET | `/sessions/:id` | Session with steps, never answer rules |
| PATCH | `/sessions/:id/start` | Added |
| PATCH | `/sessions/:id/pause` | |
| PATCH | `/sessions/:id/resume` | |
| PATCH | `/sessions/:id/stop` | Added: saves state, can be resumed |
| POST | `/sessions/:id/steps/:stepId/results` | Requires `Idempotency-Key` |
| POST | `/sessions/:id/steps/:stepId/advance` | Added: moves on. Finishing the last step completes the session |

Start, stop, and advance were added because the required journeys need them and a generic update would bypass the session state machine.

```http
POST /api/sessions/{id}/steps/{stepId}/results
Idempotency-Key: 9f1c2d3e4b5a69788796a5b4c3d2e1f0

{ "answer": { "type": "choice", "value": "A" }, "supportUsed": ["AUDIO"] }
```

Answer types are `choice`, `order`, `completed`, and `caregiver_confirmed`. The first request returns `201`. A replay returns `200` with `replayed: true`. The same key with a different payload returns `409 IDEMPOTENCY_CONFLICT`.

## Progress and caregiver support

| Method | Path | Notes |
|---|---|---|
| GET | `/children/:id/progress` | Per-skill progress |
| GET | `/children/:id/progress/:skillCode` | Progress and history |
| POST | `/children/:id/progress/:skillCode/review` | Added: `{ decision: "ADVANCE" or "KEEP_PRACTICING" }` |
| GET, PATCH | `/children/:id/routines` | `{ days, time, durationMinutes, breakMinutes, remindersEnabled }` |
| GET | `/children/:id/notes` | Added: optional `?skill=` |
| POST | `/children/:id/notes` | `{ body, skillCode?, sessionId? }` |
| GET | `/children/:id/summaries` | Added: read-only `SessionCompleted` summaries |

## Materials and integration

| Method | Path | Notes |
|---|---|---|
| GET | `/materials?skill=&level=&format=` | Includes `source`, `degraded`, and `reason` |
| GET | `/materials/stored` | Added: valid stored materials |
| GET | `/activities?skill=&level=` | Without answer rules |
| GET | `/integrations/status` | Reachability, stored counts, recent calls |
| GET | `/partner/skills` | Cross-group, needs `X-API-Key` with `skills:read` |
| GET | `/health` | Database check |

## Proposed provider contract

This is still a proposal. Partner identity, endpoints, authentication, rate limits, and content permissions must be agreed in both groups' READMEs.

```http
GET {MATERIAL_PROVIDER_URL}/materials?skill_code=READING&level=1&format=VISUAL
```

```json
{ "data": [{ "material_id": "reading-l1-visual", "version": 1, "skill_code": "READING", "level": 1, "format": "VISUAL", "media_url": "https://cdn.example.test/a.png", "title": "Mengenal huruf" }] }
```

```http
GET {ACTIVITY_PROVIDER_URL}/activities?skill_code=COUNTING&level=1
```

```json
{ "data": [{ "activity_id": "count-qty-3", "version": 1, "skill_code": "COUNTING", "level": 1, "title": "Hitung apel", "steps": [{ "instruction": "Ada berapa apel?", "options": ["2", "3", "5"] }], "example": "...", "hint": "...", "answer_rule": { "type": "exact", "value": "3" } }] }
```

`title`, `example`, `hint`, and activity `level` are optional. `answer_rule.type` is `exact`, `ordered`, `completion`, or `caregiver_confirmation`.

### Data transformation example

| Provider field | Internal field |
|---|---|
| `activity_id` | `activityId` |
| `version: 1` | `version: "1"` |
| `skill_code` | `skillCode` |
| `steps[].options` with an `exact` rule | `response: { kind: "choice", options }` |
| `steps[].target` with a `completion` rule | `response: { kind: "trace", target }` |
| `answer_rule` | `answerRule`, kept on the server |
