// Prisma 7 config. Next.js loads .env.local automatically; the Prisma CLI does
// not, so we load both here in the order Next would (.env first, then .env.local
// overrides). Keeps a single source of truth between runtime and CLI.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Order: shell env wins (so you can set DATABASE_URL inline for one-off prod
// pushes), then .env.local fills in dev-only values, then .env fills any gaps.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Required by `prisma migrate dev` against Prisma local dev server, which
    // serves the main DB and a shadow DB on different ports. Without this,
    // migrate tries to spin up a shadow on the main connection and gets P1017.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
