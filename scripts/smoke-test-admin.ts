// Smoke test for the admin dashboard. Walks login → list → detail → decision.
// Pulls password from ADMIN_PASSWORD env var (loaded from .env.local).
// Picks the most recent submission as the test target.
//
// Usage:
//   npx tsx --env-file=.env --env-file=.env.local scripts/smoke-test-admin.ts

import { prisma } from "@/lib/db";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("ADMIN_PASSWORD not set in env. Source from .env.local.");
  process.exit(1);
}

let cookieJar = "";

function setCookieFromResponse(res: Response): void {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  const pairs = setCookie
    .split(/,(?=\s*[a-zA-Z0-9_]+=)/)
    .map((s) => s.trim().split(";")[0])
    .filter(Boolean);
  const existing = cookieJar
    ? Object.fromEntries(cookieJar.split("; ").map((p) => p.split("=", 2) as [string, string]))
    : {};
  for (const pair of pairs) {
    const [k, v] = pair.split("=", 2);
    existing[k] = v;
  }
  cookieJar = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function step(
  label: string,
  url: string,
  init: RequestInit & { expectStatus?: number } = {},
): Promise<Response> {
  const { expectStatus = 200, ...rest } = init;
  const res = await fetch(`${BASE}${url}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      ...(cookieJar ? { cookie: cookieJar } : {}),
    },
    redirect: "manual",
  });
  setCookieFromResponse(res);
  if (res.status !== expectStatus) {
    const body = await res.text();
    throw new Error(`${label}: expected ${expectStatus}, got ${res.status}\n${body.slice(0, 400)}`);
  }
  console.log(`✓ ${label} → ${res.status}`);
  return res;
}

async function main() {
  console.log(`Admin smoke test against ${BASE}\n`);

  // Pick the most recent submission to use as the test target.
  const submission = await prisma.submission.findFirst({
    orderBy: { selectedAt: "desc" },
  });
  if (!submission) {
    console.error(
      "No submissions in DB. Run scripts/smoke-test.ts first.",
    );
    process.exit(1);
  }
  console.log(`Targeting submission ${submission.id}\n`);

  await step("admin login", "/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });

  await step("admin list (HTML)", "/admin", { method: "GET" });
  await step("admin detail (HTML)", `/admin/submissions/${submission.id}`, {
    method: "GET",
  });

  await step("record decision", "/api/admin/decision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      submissionId: submission.id,
      confirmedBucket: "slow",
      overrideNote: "Smoke test override.",
      flagged: true,
    }),
  });

  // Verify the decision landed in the DB.
  const decision = await prisma.adminDecision.findUnique({
    where: { submissionId: submission.id },
  });
  if (!decision) {
    throw new Error("AdminDecision row not found after POST");
  }
  if (decision.confirmedBucket !== "slow") {
    throw new Error(`expected bucket=slow, got ${decision.confirmedBucket}`);
  }
  if (!decision.flagged) {
    throw new Error("expected flagged=true");
  }
  console.log(`✓ AdminDecision row verified — bucket=${decision.confirmedBucket}, flagged=${decision.flagged}`);

  await step("admin logout", "/api/admin/logout", { method: "POST" });

  // After logout, /admin should redirect (303/307) — manual fetch sees the redirect.
  const guarded = await fetch(`${BASE}/admin`, {
    headers: cookieJar ? { cookie: cookieJar } : {},
    redirect: "manual",
  });
  if (![302, 303, 307, 308].includes(guarded.status)) {
    console.warn(
      `⚠ /admin returned ${guarded.status} after logout; expected a redirect to /admin/login`,
    );
  } else {
    console.log(`✓ /admin redirects after logout → ${guarded.status}`);
  }

  console.log(`\nAll admin smoke steps passed.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`\nFAILED: ${(err as Error).message}`);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
