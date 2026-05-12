import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db";
import {
  participantSessionOptions,
  type ParticipantSession,
  type ParticipantSessionData,
} from "./session";

export async function getParticipantSession(): Promise<ParticipantSession> {
  // Next.js 16: cookies() is async — must be awaited before passing to iron-session.
  const cookieStore = await cookies();
  return getIronSession<ParticipantSessionData>(
    cookieStore,
    participantSessionOptions(),
  );
}

export async function getCurrentParticipant() {
  const session = await getParticipantSession();
  if (!session.participantId) return null;
  return prisma.participant.findUnique({
    where: { id: session.participantId },
  });
}

// PRD §5.1: participant enters their name + token. Both must match a row.
// Token alone is sufficient to identify the participant; the name is a check
// against shoulder-surfed tokens (mismatch → reject) but is not stored anew.
export async function authenticateParticipant(input: {
  name: string;
  token: string;
}) {
  const participant = await prisma.participant.findUnique({
    where: { token: input.token },
  });
  if (!participant) return null;
  const expected = participant.name.trim().toLowerCase();
  const provided = input.name.trim().toLowerCase();
  if (expected !== provided) return null;

  const session = await getParticipantSession();
  session.participantId = participant.id;
  await session.save();
  return participant;
}

export async function clearParticipantSession(): Promise<void> {
  const session = await getParticipantSession();
  session.destroy();
}
