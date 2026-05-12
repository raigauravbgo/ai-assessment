import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { getIronSession } from "iron-session";
import {
  adminSessionOptions,
  type AdminSession,
  type AdminSessionData,
} from "./session";

export async function getAdminSession(): Promise<AdminSession> {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, adminSessionOptions());
}

export async function isAdmin(): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session.isAdmin);
}

// PRD §9: single hardcoded admin login. No usernames, no rotation. The
// password lives in ADMIN_PASSWORD; we compare in constant time to avoid
// any side-channel even though the surface is tiny.
export async function authenticateAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set (see .env.example).");
  }
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  const session = await getAdminSession();
  session.isAdmin = true;
  await session.save();
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const session = await getAdminSession();
  session.destroy();
}
