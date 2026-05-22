// Prisma 7 client. Lazy via Proxy — importing this module doesn't touch
// process.env, so Next.js's build-time "collect page data" phase succeeds
// even when DATABASE_URL hasn't been injected yet (e.g. Railway runs
// `npm run build` before the Postgres add-on is fully wired in some cases).
// The connection is only established the first time a Prisma method is
// actually called at runtime.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local locally, or to Railway's service Variables in production.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = buildPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

// Proxy forwards property access to a lazily-constructed PrismaClient.
// `prisma.submission.findMany(...)` works exactly as before — but referencing
// `prisma` without using it (e.g. just importing the module) does NOT touch
// process.env or open any connection.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrisma(), prop, getPrisma());
  },
}) as PrismaClient;
