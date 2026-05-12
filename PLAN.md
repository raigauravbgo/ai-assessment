# Build Plan — 3-day MVP

**Start:** 2026-05-11 (Mon) · **Ship:** 2026-05-13 (Wed EOD) · **Buffer:** 2026-05-14 AM

**Scope for this build:** PRD §14 Phase 1 only — core assessment loop end-to-end. Learning module, improvement tracking, and role expansion are **deferred** (Phases 2–4).

Sequencing rule: nothing on Day N can depend on something not yet done by end of Day N−1. Mark `[x]` as you go; if a task slips, move it down and re-check the dependency chain.

---

## Pre-build content lock (do first thing Mon AM)

These are PRD §13 open questions. Code can't proceed without final copy.

- [x] Lock final wording of the 3 diagnostic questions — placeholder wording locked in [lib/config/diagnostic-questions.ts](lib/config/diagnostic-questions.ts); flagged for user review before first cohort run
- [x] Finalise the 3 engineering problems — locked as A (call queue) + D (theme extractor) + C (resume screener), spec in [PROBLEMS.md](PROBLEMS.md)
- [ ] Decide participant-facing post-submission summary template (directional, no bucket — PRD §6)
- [ ] Generate fixture data per PROBLEMS.md "Open content tasks before go-live" (CSVs for A/D, resume set for C, one reference solution each)

---

## Day 1 — Mon 2026-05-11 · Foundation

**Goal by EOD:** empty Next.js app deployed to Railway, DB live, S3 wired, 3 problems seeded, token auth works.

### Infra & scaffold
- [x] `npx create-next-app` — Next.js 16 (App Router, TypeScript, Tailwind, ESLint, no src dir)
- [ ] **BLOCKED on user:** provision Postgres, capture `DATABASE_URL` (Railway / Neon / `npx prisma dev`)
- [ ] **BLOCKED on user:** provision S3-compatible bucket + credentials (Day 2 work, but provision now)
- [x] `.env.example` documents all required keys (`DATABASE_URL`, `SCORING_*`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
- [ ] **BLOCKED on user:** create `.env.local` with real values
- [ ] **BLOCKED on user:** initial Railway deploy of empty app

### Database
- [x] Install Prisma 7, init schema (using new `prisma-client` generator → `./generated/prisma`)
- [x] Model all 8 entities from PRD §10
- [x] Schema validates (`npx prisma validate` clean); client generated
- [x] Local Postgres running via `npx prisma dev` (ports 51214/51215)
- [x] Schema synced via `npm run db:sync` (`db push` — prisma dev's pglite-based server doesn't support migrate's shadow-DB flow; real `migrate dev` will be used against Railway on Day 3)

### Auth
- [x] Participant auth helpers (`lib/auth/participant.ts`) + `POST /api/participant/login,logout`
- [x] Admin login (`lib/auth/admin.ts`, constant-time password check) + `POST /api/admin/login,logout`
- [ ] Login UI pages (Day 2 — combined with the participant portal)

### Problem config
- [x] JSON file format per problem in `problems/engineering-{a,d,c}.json`
- [x] Seed script `scripts/seed-problems.ts` (zod-validated, idempotent upsert) wired as `npm run db:seed`
- [x] All 3 engineering problems live in the local DB

### Prompt scaffolding
- [x] `/prompts/` directory with 5 stubs (`zone`, `traps`, `ai-fingerprint`, `notes`, `diagnostic`) + shared `types.ts` + `index.ts` barrel
- [x] Each exports a parameterised `build*Prompt(problem, artifacts)` and a Zod output schema; bodies are Day 2 TODOs

### End-of-day verification
- [x] `npx tsc --noEmit` passes
- [x] `npm run dev` boots; `/` returns 200
- [x] `.env.local` written with generated `SESSION_SECRET` (64-char hex) + starter `ADMIN_PASSWORD` (16-char lowercase) — change the password before sharing the deployed URL

---

## Day 2 — Tue 2026-05-12 · Participant flow + scoring engine

**Goal by EOD:** a participant can hit `/?token=X`, pick a problem, submit a zip + notes + diagnostic answers, and the scoring pipeline runs to completion with all 5 dimensions stored.

### Participant portal
- [x] Landing page (`app/page.tsx`) — name + token entry, calls `/api/participant/login`; prefills token from `?token=` query param
- [x] Problem selection page (`app/problems/page.tsx`) — 3 cards, lock on click, creates `Submission` with `status=selected`, `selectedAt=now()`
- [x] Submission page (`app/submit/page.tsx`) — zip upload, notes textarea, live 48-hour countdown (`submit-form.tsx`)
- [x] Zip upload handler → local `./uploads/<submissionId>.zip` (S3 deferred to Day 3 wrapper swap), Submission updates `zipPath`/`notesText`/`submittedAt`/`status=submitted`
- [x] Diagnostic chat (`app/diagnostic/`) — 3 sequential questions, each writes a `DiagnosticResponse` row, last one fires scoring fire-and-forget
- [x] Post-submission confirmation (`app/done/page.tsx`) — directional placeholder (no bucket label, per PRD §6)

### Scoring engine
- [x] Scoring client `lib/scoring/llm.ts` — plain `fetch` + Zod 4's built-in `toJSONSchema()`, no SDK dep. Provider-agnostic via `SCORING_BASE_URL` / `SCORING_API_KEY` / `SCORING_MODEL`; default OpenRouter+Claude-Sonnet-4.5
- [x] Zip extraction utility (`lib/zip/extract.ts`) — hard limits (50 MB / 500 files / 200 KB per text file), path traversal rejection, skips `node_modules/.git/dist` etc.
- [x] Five prompt bodies written (`prompts/{zone,traps,ai-fingerprint,notes,diagnostic}.ts`), each parameterised by `ProblemConfig` + `SubmissionArtifacts`, Zod-validated structured output
  - [x] Zone — binary per zone + observations, score derived as 0–3 in orchestrator
  - [x] Traps — caught/partial/missed per defined trap + evidence citation
  - [x] AI fingerprint — 5 markers (PRD §5.4) + overall 1–5 + summary
  - [x] Notes — orchestrator short-circuits to null sub-scores if notesText is empty (PRD §5.4 D4)
  - [x] Diagnostic — per-question forward/backward score + extracted most-revealing phrase
- [x] Pipeline orchestrator (`lib/scoring/orchestrate.ts`) — `Promise.all` over 5 dimensions, upserts Score row, marks Submission status=`scored`
- [x] Raw Claude responses persisted in `Score.rawResponses` (PRD §11 auditability)
- [x] Bucketing function (`lib/scoring/bucket.ts`) — pure, 15 unit tests covering fast/slow/low + boundary cases (PRD §5.5 AND-logic)

### Admin tooling
- [x] `npm run cycle:new -- --role engineering --hours 48` creates an `AssessmentCycle`
- [x] `npm run participant:new -- --name "X" --cycle <id>` creates a Participant and prints the token URL

### End-of-day-2 verification
- [x] `npx tsc --noEmit` clean across the full repo
- [x] `npm test` — 15 bucket tests pass
- [x] HTTP smoke test (`scripts/smoke-test.ts`) — login → select-problem → upload (fake zip) → 3 diagnostics → done — all 6 steps return 200
- [x] DB state verified post-flow: Submission `status=submitted`, 3/3 diagnostic responses, scoring fire-and-forget triggered (fails gracefully without `SCORING_API_KEY`)

---

## Day 3 — Wed 2026-05-13 · Admin dashboard + ship

**Goal by EOD:** admin can log in, view a submission's full reasoning + bucket suggestion, confirm/override, and the whole flow is live on Railway.

### Admin individual view (`app/admin/(authed)/submissions/[id]/page.tsx`)
- [x] One screen per participant, rendered in PRD §5.5 order:
  - [x] Header — participant + problem + status + timestamps
  - [x] Five dimension scorecards with plain-English reasoning and evidence citations
  - [x] Raw participant input — notes + diagnostic answers verbatim
  - [x] Most revealing phrase + reason
  - [x] **Then** suggested bucket with reasoning
  - [x] Admin action — `DecisionForm` writes `AdminDecision` (confirm / override-with-required-note / flag)
- [x] Pre-score states handled: `selected` (waiting on upload), `submitted` (waiting on or failed scoring → **Run scoring** button via `/api/admin/rescore`), `expired` (window elapsed)
- [ ] Learning module completion field — **deferred to Phase 2** per scope freeze

### Admin aggregate view (`app/admin/(authed)/page.tsx`)
- [x] Table of all submissions × cycles, newest first, with participant / problem / cycle / status / submitted / bucket / admin-decision columns
- [x] Click-through to individual view
- [ ] Filter pills — **deferred**; hackathon cohort fits on one screen

### Cycle management
- [x] Create cycle — CLI: `npm run cycle:new -- --role engineering --hours 48`
- [x] Create participant + print token URL — CLI: `npm run participant:new`
- [ ] In-dashboard cycle creation UI — **deferred**; CLI is enough for v1

### Ship
- [x] `npm run build` clean — 7 admin routes + 7 participant routes + 4 protected page routes
- [x] Admin smoke test (`scripts/smoke-test-admin.ts`) — 7/7 steps green
- [x] `UPLOADS_DIR` env override so Railway Volume mount works without code changes
- [x] [DEPLOY.md](DEPLOY.md) — step-by-step Railway deployment guide
- [ ] **BLOCKED on user:** push repo to GitHub, provision Railway, set env vars, mount Volume, push schema to prod, deploy
- [ ] **BLOCKED on user:** paste OpenRouter key into `SCORING_API_KEY` in `.env.local` and re-run scoring (via `/admin/submissions/[id]` → Run scoring) for a real end-to-end pass before deploying
- [ ] **BLOCKED on user:** generate tokens for the actual hackathon cohort + hand out

### End-of-day-3 verification
- [x] `npx tsc --noEmit` clean
- [x] `npm test` — 15 bucket tests still pass
- [x] `npm run build` clean
- [x] Participant flow smoke test — 6/6 steps green
- [x] Admin flow smoke test — 7/7 steps green

---

## Explicitly deferred (do not build in this 3-day window)

- Module 1 — Learning module + content (PRD §4, Phase 2)
- Module 3 — Improvement tracking, delta view, cohort cycle comparison (PRD §6, Phase 3)
- Role expansion — collections, other functions (PRD §7, Phase 4)
- Retake problem assignment logic
- Mobile UI, email notifications, multi-admin (PRD §12)

If anyone asks for these mid-build, the answer is "post-hackathon."

---

## Risk register

- **Claude API latency / failures during scoring** — pipeline must be async (don't block submission HTTP response on scoring). Show "scoring in progress" in admin view.
- **Zip extraction edge cases** — enforce hard limits (e.g. 500 files, 50 MB) and reject early. Don't let one weird zip kill the pipeline.
- **Prompt quality** — first runs will be rough. Reserve Wed PM for at least one prompt-tuning pass on a real submission.
- **Content lock slipping into Mon PM** — biggest schedule risk. If diagnostic wording or problem definitions aren't done by Mon lunch, Day 2 scoring work can't start cleanly.
