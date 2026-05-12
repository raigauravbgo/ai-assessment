// iron-session config shared between participant + admin flows.
// Two distinct cookies so the two sessions can coexist on the same browser.
import type { IronSession, SessionOptions } from "iron-session";

export type ParticipantSessionData = {
  participantId?: string;
};

export type AdminSessionData = {
  isAdmin?: boolean;
};

export type ParticipantSession = IronSession<ParticipantSessionData>;
export type AdminSession = IronSession<AdminSessionData>;

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters (see .env.example).",
    );
  }
  return secret;
}

export function participantSessionOptions(): SessionOptions {
  return {
    password: requireSecret(),
    cookieName: "ai_eval_participant",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // 48h matches PRD §5.1 work window. Even if the participant closes
      // their tab, the cookie outlasts the session.
      maxAge: 60 * 60 * 48,
    },
  };
}

export function adminSessionOptions(): SessionOptions {
  return {
    password: requireSecret(),
    cookieName: "ai_eval_admin",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    },
  };
}
