import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { publishToMany } from '@/lib/realtime';

const schema = z.object({ conversationId: z.string().cuid() });

/**
 * POST /api/messages/typing — broadcast a transient "typing…" signal to the
 * other participant(s) of a conversation (Section 8.3). Not persisted.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { conversationId } = schema.parse(await req.json().catch(() => ({})));

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const participantIds = participants.map((p) => p.userId);
  // Only a participant may broadcast typing — shared authorizer (rule 5).
  if (!(await can(user, 'conversation:access', { participantIds }))) {
    return jsonOk({ ok: false });
  }

  const others = participantIds.filter((id) => id !== user.id);
  publishToMany(others, { type: 'typing', conversationId, userId: user.id });

  return jsonOk({ ok: true });
});
