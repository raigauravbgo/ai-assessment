# Deploy to Railway

End-to-end deployment for the BGO AI Capability Assessment platform. The app is a single Next.js service plus a managed Postgres instance plus a Volume for uploaded zips.

> **Why Railway:** PRD §9 names it as the host. Picks: it provisions Postgres in one click, supports volumes for the zip uploads, and auto-deploys from a Git push. No Dockerfile needed.

## What you'll need before starting

- A Railway account ([railway.app](https://railway.app)) with billing enabled
- The repository pushed to GitHub (Railway can also deploy from a local CLI, but GitHub auto-deploy is what this guide assumes)
- An API key for whatever LLM provider you're using (OpenRouter / OpenAI / etc. — the scoring client is provider-agnostic)
- ~15 minutes

---

## 1. Push the repo to GitHub

The repo currently lives locally with a fresh `git init` from `create-next-app`. If you haven't pushed it:

```bash
# In c:\Dev\ai-evaluator
git add -A
git commit -m "Initial commit — Days 1-3 build"
gh repo create ai-evaluator --private --source=. --push
```

(Use whatever account/visibility you want. Railway needs read access.)

---

## 2. Create the Railway project

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → pick `ai-evaluator`.
2. Railway auto-detects Next.js. Let it. Don't override build/start commands.
3. The first deploy will **fail** because env vars aren't set yet. That's fine.

---

## 3. Add Postgres

In the same Railway project:

1. **+ New** → **Database** → **Add PostgreSQL**.
2. Railway auto-injects `DATABASE_URL` into your web service. Verify by opening the web service → **Variables** tab and confirming `DATABASE_URL` is present (refs the Postgres service).

---

## 4. Add a Volume for zip uploads

Container disks are ephemeral; uploaded zips would disappear on restart. Mount a Volume:

1. Web service → **Settings** → **Volumes** → **+ New Volume**.
2. **Mount Path:** `/data/uploads`
3. **Size:** 1 GB is more than enough for a hackathon cohort (~15 zips × < 50 MB each).

Then set the env var so the app writes there:

- Web service → **Variables** → **+ New Variable**: `UPLOADS_DIR` = `/data/uploads`.

---

## 5. Set the rest of the env vars

In **Variables** on the web service, add:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | 64-char hex. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PASSWORD` | A new password. **Do not reuse the local dev one.** |
| `SCORING_BASE_URL` | `https://openrouter.ai/api/v1` (or your provider's base URL) |
| `SCORING_API_KEY` | Your provider API key (`sk-or-...` for OpenRouter, `sk-...` for OpenAI) |
| `SCORING_MODEL` | `anthropic/claude-sonnet-4.5` for OpenRouter, or `gpt-4o-2024-08-06` for OpenAI |
| `APP_BASE_URL` | `https://<your-service>.up.railway.app` (after Railway generates the domain — see step 6) |
| `UPLOADS_DIR` | `/data/uploads` (from step 4) |
| `NODE_ENV` | `production` (Railway usually sets this automatically) |

Don't set `DATABASE_URL` manually — Railway injects it from the Postgres service.

---

## 6. Generate the public domain

Web service → **Settings** → **Networking** → **Generate Domain**.

Railway gives you `https://<name>.up.railway.app`. Set `APP_BASE_URL` to this in **Variables** (step 5).

---

## 7. Apply the schema to production Postgres

The repo has no migration files yet (local dev used Prisma's `db push` because the pglite-based prisma-dev server doesn't support `migrate dev`). For the first production deploy, push the schema directly.

**One-time setup, from your local machine:**

```bash
# In c:\Dev\ai-evaluator
# Replace the URL with your Railway Postgres connection string —
# Railway dashboard → Postgres service → Connect → "Postgres Connection URL"
$env:DATABASE_URL = "postgresql://postgres:...@host.railway.app:5432/railway"
npx prisma db push
npx prisma generate
```

Then seed the problems against the same DB:

```bash
$env:DATABASE_URL = "postgresql://postgres:...@host.railway.app:5432/railway"
npx tsx scripts/seed-problems.ts
```

> Once shipped, switch to versioned migrations: run `npx prisma migrate dev --name init` against a real Postgres (not prisma dev) to generate `prisma/migrations/`, commit them, and change deploys to use `npm run db:deploy`.

---

## 8. Trigger a deploy

Either:

- Push a no-op commit to GitHub (Railway redeploys), or
- Railway service → **Deployments** → **Redeploy** (top right).

The build should run `prisma generate` (postinstall) → `next build`, then `next start`. Watch the logs; expected output ends with `▲ Next.js 16.x.x — Ready on port 3000`.

---

## 9. Smoke-test in production

From your machine:

```bash
# Hit the homepage (should return 200, render the participant login form)
curl -I https://<your-service>.up.railway.app/

# Sign into admin and confirm the dashboard loads
# Then create a cycle + a real participant against the prod DB:
$env:DATABASE_URL = "postgresql://...railway..."
$env:APP_BASE_URL = "https://<your-service>.up.railway.app"
npx tsx --env-file=.env --env-file=.env.local scripts/create-cycle.ts --role engineering --hours 48
npx tsx --env-file=.env --env-file=.env.local scripts/create-participant.ts --name "Real Participant" --cycle <id>
# Use the printed token URL to walk through the flow yourself before sharing.
```

---

## 10. Hand out tokens

For each cohort member:

```bash
npx tsx --env-file=.env --env-file=.env.local scripts/create-participant.ts --name "Person Name" --cycle <cycleId>
```

The script prints a URL like `https://<your-service>.up.railway.app/?token=abc123`. Send each person their own link.

---

## After the cycle: rescore + override

The admin dashboard at `/admin` shows every submission. Scoring fires automatically when a participant finishes their three diagnostic answers — if it fails (rate limit, transient API error, etc.), the submission detail page has a **Run scoring** button to retry synchronously.

For every confirmed-or-overridden bucket, the admin's decision is logged in `AdminDecision` with a note (required for overrides).

---

## Common deploy issues

| Symptom | Fix |
|---|---|
| Build fails at `prisma generate` | Make sure `postinstall` is firing. Check the build logs for "Prisma Client generated to ./generated/prisma". |
| Scoring fails with "SCORING_API_KEY is not set" | The scoring orchestrator reads env lazily — it only errors after a participant finishes the diagnostic. Set `SCORING_API_KEY` in Railway Variables. |
| Uploaded zips disappear after redeploy | Volume not mounted, or `UPLOADS_DIR` not pointing at the mount path. |
| `db push` errors with `P1001 cant reach` | Use the **public** connection URL from Railway (Connect tab), not the internal one. |
| Tokens contain `+` or `/` and break URL parsing | They shouldn't — `randomBytes(12).toString("base64url")` is URL-safe. If they do, regenerate. |
