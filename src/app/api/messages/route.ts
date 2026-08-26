import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendMessageSchema } from '@/lib/validators/misc';
import {
  findOrCreateConversation,
  sendMessage,
  getConversationsForUser,
  markConversationRead,
} from '@/lib/messaging';

/** GET /api/messages — list conversations, OR ?conversationId= for its history. */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const conversationId = new URL(req.url).searchParams.get('conversationId');

  if (!conversationId) {
    return jsonOk({ conversations: await getConversationsForUser(user.id) });
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: user.id },
  });
  if (!participant) throw new ApiError('FORBIDDEN', 'Not your conversation.');

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  await markConversationRead(conversationId, user.id);

  return jsonOk({
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    })),
  });
});

/** POST /api/messages — send a message (starting a conversation if needed). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = sendMessageSchema.parse(await req.json().catch(() => ({})));

  let conversationId = input.conversationId;

  if (!conversationId) {
    // Derive the recipient from the listing/job being discussed.
    let otherUserId = input.recipientId ?? null;
    if (!otherUserId && input.listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: input.listingId },
        select: { sellerId: true },
      });
      otherUserId = listing?.sellerId ?? null;
    }
    if (!otherUserId && input.jobId) {
      const job = await prisma.job.findUnique({
        where: { id: input.jobId },
        select: { employerId: true },
      });
      otherUserId = job?.employerId ?? null;
    }
    if (!otherUserId) throw new ApiError('BAD_REQUEST', 'No recipient for this conversation.');

    conversationId = await findOrCreateConversation({
      userId: user.id,
      otherUserId,
      listingId: input.listingId ?? null,
      jobId: input.jobId ?? null,
    });
  }

  const message = await sendMessage({
    conversationId,
    senderId: user.id,
    body: input.body,
  });

  return jsonOk({ conversationId, message }, { status: 201 });
});
