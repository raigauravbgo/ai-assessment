# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Source of truth docs

- [PRD.md](PRD.md) — product behavior, scoring rules, data model
- [PROBLEMS.md](PROBLEMS.md) — the three locked engineering problems (A/D/C); the seed script reads JSON in [problems/](problems/) which must mirror this doc
- [PLAN.md](PLAN.md) — 3-day MVP plan with checkbox progress
- [DEPLOY.md](DEPLOY.md) — step-by-step Railway deployment guide

## Common commands

```
npm run dev                  # Next.js dev server (Turbopack)
npm run build                # production build
npm run lint                 # ESLint
npm test                     # vitest run (currently the bucketing tests)
npx tsc --noEmit             # type-check
npm run db:sync              # prisma db push — use against prisma dev / local; production uses db:migrate
npm run db:migrate           # prisma migrate dev (for real Postgres only, e.g. Railway)
npm run db:deploy            # prisma migrate deploy (production)
npm run db:seed              # upserts the 3 engineering problems from /problems/*.json
npm run cycle:new -- --name "X" --role engineering --hours 48
npm run participant:new -- --name "Y" --cycle <cycleId>   # prints token URL
```

Smoke-test the participant flow:
```
# 1. start `npx prisma dev` if not running; then `npm run dev` in another shell
# 2. seed + create cycle + participant
# 3. point smoke script at the participant's token:
$env:SMOKE_TOKEN="<token>"; $env:SMOKE_NAME="<name>"; npx tsx --env-file=.env --env-file=.env.local scripts/smoke-test.ts
```

## Stack

- **Next.js 16** App Router, TypeScript, Tailwind 4, no `src/` dir.
- **Prisma 7** with the new `prisma-client` generator. Output is `./generated/prisma` (gitignored). Import via `@/generated/prisma/client`, not `@prisma/client`. The runtime needs the `@prisma/adapter-pg` adapter passed to `new PrismaClient({ adapter })` — `url` is no longer in the schema, it lives in `prisma.config.ts` (reads `DATABASE_URL`).
- **iron-session 8** for both participant + admin sessions (two distinct cookies). `cookies()` is async in Next 16 — must await before passing to `getIronSession`.
- **AI:** Provider-agnostic — `lib/scoring/llm.ts` uses plain `fetch` against any OpenAI-wire-format endpoint (OpenRouter / OpenAI / Together / Groq / LiteLLM). Picked via `SCORING_BASE_URL` + `SCORING_API_KEY` + `SCORING_MODEL` env vars. Default: OpenRouter calling `anthropic/claude-sonnet-4.5` (PRD §9's Claude spec, no Anthropic-direct key needed). Structured output via standard `response_format: { type: "json_schema" }`; Zod schemas → JSON Schema via Zod 4's built-in `z.toJSONSchema()`; response re-validated with Zod after parse. No SDK dependency.
- **Object storage:** local `./uploads/<submissionId>.zip` for dev (`lib/zip/storage.ts`). Day 3 swap to S3 = change those two functions, no other code touched. `zipPath` on Submission is a relative path so it works on dev box and Railway alike.
- **Zip extraction** (`lib/zip/extract.ts`) — hard limits: 50 MB total, 500 files, 200 KB per text file. Rejects path traversal/absolute paths. Strips `node_modules/.git/.venv/dist/build/.next` from output.

See [AGENTS.md](AGENTS.md) for the Next.js team's warning about training-data drift in Next 16. Read `node_modules/next/dist/docs/` before making non-trivial Next changes.

## Architecture invariants — don't violate these

These are deliberate product decisions in the PRD. Changing them is a product call, not an implementation detail.

1. **Scoring is parameterised and role-configurable.** The five scoring dimensions (zone, traps, AI fingerprint, notes, diagnostic) are role-agnostic; the *evidence markers* are passed as config per role/problem. Do not hardcode prompts to a specific problem. (PRD §11)
2. **Prompts live in the codebase as files, not in the DB.** They must be version-controlled. Raw Claude responses are stored alongside parsed scores for auditability. (PRD §11)
3. **Notes scoring distinguishes null from zero.** Empty/absent notes → `null` for all three sub-scores. A submitted-but-weak note → a low score. These are *different signals* — never collapse them. (PRD §5.4 Dimension 4)
4. **Low-multiplier bucket uses AND logic across three dimensions.** AI fingerprint 1–2 AND traps mostly missed AND flat diagnostic. All three required. The high bar is intentional. (PRD §5.5)
5. **Admin sees reasoning before the suggested bucket.** The UI must surface dimension scores + reasoning *first*, then the suggested bucket. This is to force an independent read. Don't reorder. (PRD §5.5)
6. **Problem selection is locked on click.** No switching after a participant picks a problem. 48-hour countdown starts at selection. (PRD §5.1)
7. **No completion gate on the learning module.** Participants can skip learning and still take the assessment; completion is *tracked, not enforced*. (PRD §4)
8. **Participants never see their bucket label.** Only a directional summary post-assessment. (PRD §6)

## Data model anchor (PRD §10)

Core entities: `Participant`, `AssessmentCycle`, `Submission`, `DiagnosticResponse`, `Score`, `AdminDecision`, `Problem`, `LearningCompletion`. The `Score` row stores per-dimension scores *plus* the reasoning text and evidence citations — the admin UI reads from this directly. `AdminDecision` is separate so overrides are logged without mutating the AI's output.

## Scoring pipeline shape

Fires automatically when a zip is submitted (PRD §5.4). Five prompts run in parallel, one per dimension. Each returns structured JSON (scores + reasoning + evidence). The bucketing function is a pure function of dimension scores — keep it that way so it can be unit-tested without an LLM call.

Out of scope for v1: git/commit-history analysis, video, email/notifications, multi-admin, mobile UI, learning content authoring UI (content is markdown in the repo). See PRD §12 before adding any of these.

## Open product questions (PRD §13)

Don't assume these are settled when reading the PRD:
- Final wording of the three diagnostic questions — **placeholder locked** in [lib/config/diagnostic-questions.ts](lib/config/diagnostic-questions.ts); flagged for review before first cohort
- The initial three engineering problems and their trap definitions — **locked**, see [PROBLEMS.md](PROBLEMS.md)
- Participant-facing communication copy — **still open**; `app/done/page.tsx` shows a static directional message for v1

If a task depends on one of the open items, flag it rather than inventing content.

## Participant flow (`resolveFlowState` in `lib/auth/flow.ts`)

Each protected page calls `resolveFlowState(participant)` and redirects if the participant isn't on the right stage. The state machine:

```
no submission           → select-problem  (/problems)
selected, no zip        → upload          (/submit)
zip uploaded, <3 diag   → diagnostic      (/diagnostic)
3 diag answers in       → done            (/done)
```

The third diagnostic POST fires `scoreSubmission(submissionId)` fire-and-forget — failures are logged server-side, never surfaced to the participant.

## Repo layout

```
app/                       # Next.js routes
  page.tsx                 #   landing (token + name)
  login-form.tsx           #   client component for the login form
  problems/                #   problem selection
  submit/                  #   zip upload + 48h countdown
  diagnostic/              #   3-question chat
  done/                    #   post-submission confirmation
  api/participant/         #   {login, logout, select-problem, upload, diagnostic}
  api/admin/               #   {login, logout}
lib/db.ts                  # Prisma client singleton (uses adapter-pg)
lib/auth/                  # session.ts + participant.ts + admin.ts + flow.ts (state machine)
lib/config/                # diagnostic-questions.ts (PRD §5.3 placeholder wording)
lib/scoring/               # bucket.ts + llm.ts + orchestrate.ts + bucket.test.ts
lib/zip/                   # extract.ts + storage.ts (local dev; swap to S3 Day 3)
prompts/                   # 5 scoring prompts per PRD §11 — parameterised by ProblemConfig
problems/                  # one JSON per problem; seed script reads these
scripts/                   # seed-problems, create-cycle, create-participant, smoke-test, smoke-check-db
prisma/schema.prisma
generated/prisma/          # generated Prisma client (gitignored)
uploads/                   # local zip storage (gitignored)
```
