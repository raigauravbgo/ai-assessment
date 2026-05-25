// Prisma 7 client. Lazy via Proxy — importing this module doesn't touch
// process.env, so Next.js's build-time "collect page data" phase succeeds
// even when DATABASE_URL hasn't been injected yet. The connection is only
// established the first time a Prisma method is actually called at runtime.
//
// CRITICAL: the underlying PrismaClient must be a singleton across the
// process. Without that, every `prisma.X` access through the Proxy would
// construct a fresh client, and methods like $transaction would lose track
// of state between their internal `this.X` calls (P2028).
//
// We cache on globalThis so Next.js HMR in dev doesn't accumulate clients,
// and the module-load path remains side-effect-free.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  _aiEvaluatorPrisma?: PrismaClient;
};

function getPrisma(): PrismaClient {
  if (globalForPrisma._aiEvaluatorPrisma) return globalForPrisma._aiEvaluatorPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local locally, or to Railway's service Variables in production.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });
  globalForPrisma._aiEvaluatorPrisma = client;
  return client;
}

// Proxy defers PrismaClient construction until the first property access.
// The `receiver` argument to Reflect.get must be the SAME cached client
// so `this` inside Prisma's internal methods resolves consistently.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    return Reflect.get(client, prop, client);
  },
}) as PrismaClient;
