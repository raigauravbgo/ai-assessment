// End-to-end HTTP smoke test for the participant flow.
// Walks login → select-problem → upload (tiny zip) → 3 diagnostic answers → /done.
// The scoring pipeline fires fire-and-forget at the end; this script doesn't wait
// for it (it would fail without SCORING_API_KEY set).
//
// Usage:
//   1. Make sure `npm run dev` is running.
//   2. Create a fresh participant: `npm run participant:new -- --name "Smoke Test"`
//   3. Run: SMOKE_NAME="Smoke Test" SMOKE_TOKEN="<token>" SMOKE_PROBLEM=engineering-a npx tsx scripts/smoke-test.ts
//
//      On PowerShell:
//      $env:SMOKE_NAME="Smoke Test"; $env:SMOKE_TOKEN="<token>"; $env:SMOKE_PROBLEM="engineering-a"; npx tsx scripts/smoke-test.ts

import AdmZip from "adm-zip";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const NAME = process.env.SMOKE_NAME ?? "Jane Doe";
const TOKEN = process.env.SMOKE_TOKEN;
const PROBLEM = process.env.SMOKE_PROBLEM ?? "engineering-a";

if (!TOKEN) {
  console.error("SMOKE_TOKEN is required. Create a participant first with `npm run participant:new`.");
  process.exit(1);
}

let cookieJar = "";

function setCookieFromResponse(res: Response): void {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  const newPairs = setCookie
    .split(/,(?=\s*[a-zA-Z0-9_]+=)/)
    .map((s) => s.trim().split(";")[0])
    .filter(Boolean);
  if (newPairs.length === 0) return;
  const existing = cookieJar
    ? Object.fromEntries(cookieJar.split("; ").map((p) => p.split("=", 2) as [string, string]))
    : {};
  for (const pair of newPairs) {
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
    throw new Error(`${label}: expected ${expectStatus}, got ${res.status}\n${body}`);
  }
  console.log(`✓ ${label} → ${res.status}`);
  return res;
}

function makeFakeZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    "main.py",
    Buffer.from(
      "# smoke-test fake submission\n" +
        "import csv\n\n" +
        "def main():\n" +
        "    print('hello world')\n\n" +
        "if __name__ == '__main__':\n" +
        "    main()\n",
    ),
  );
  zip.addFile(
    "README.md",
    Buffer.from("# Smoke test\n\nThis is a fake submission for the smoke test."),
  );
  return zip.toBuffer();
}

async function main() {
  console.log(`Smoke testing against ${BASE}`);
  console.log(`  participant: ${NAME} / token=${TOKEN!.slice(0, 6)}...`);
  console.log(`  problem:     ${PROBLEM}`);
  console.log("");

  await step("login", "/api/participant/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: NAME, token: TOKEN }),
  });

  await step("select-problem", "/api/participant/select-problem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ problemId: PROBLEM }),
  });

  const zipBytes = makeFakeZip();
  const form = new FormData();
  form.append("zip", new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }), "submission.zip");
  form.append("notes", "I built a tiny example to smoke-test the flow.");
  await step("upload", "/api/participant/upload", {
    method: "POST",
    body: form,
  });

  for (let i = 0; i < 3; i++) {
    await step(`diagnostic q${i}`, "/api/participant/diagnostic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionIndex: i,
        responseText: `smoke test answer ${i}`,
      }),
    });
  }

  console.log("");
  console.log("All steps passed. Scoring runs fire-and-forget; check dev server logs.");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
