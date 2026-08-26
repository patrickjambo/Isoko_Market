import 'server-only';
import { prisma } from './prisma';
import { ApiError } from './api';
import { publishToMany } from './realtime';
import { notify } from './notifications';

/**
 * Find an existing 1:1 conversation between two users (optionally scoped to a
 * listing/job) or create one. Conversations are keyed by their participant pair
 * plus the item they are about, so buyer↔seller chats about different listings
 * stay separate.
 */
export async function findOrCreateConversation(params: {
  userId: string;
  otherUserId: string;
  listingId?: string | null;
  jobId?: string | null;
}) {
  if (params.userId === params.otherUserId) {
    throw new ApiError('BAD_REQUEST', 'You cannot message yourself.');
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      listingId: params.listingId ?? null,
      jobId: params.jobId ?? null,
      AND: [
        { participants: { some: { userId: params.userId } } },
        { participants: { some: { userId: params.otherUserId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.conversation.create({
    data: {
      listingId: params.listingId ?? null,
      jobId: params.jobId ?? null,
      participants: {
        create: [{ userId: params.userId }, { userId: params.otherUserId }],
      },
    },
    select: { id: true },
  });
  return created.id;
}

/** Persist a message, bump the conversation, and fan out realtime + notification. */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const convo = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    include: { participants: { select: { userId: true } }, listing: true, job: true },
  });
  if (!convo) throw new ApiError('NOT_FOUND', 'Conversation not found.');

  const participantIds = convo.participants.map((p) => p.userId);
  if (!participantIds.includes(params.senderId)) {
    throw new ApiError('FORBIDDEN', 'You are not part of this conversation.');
  }

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      body: params.body,
    },
  });

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  const serialized = {
    id: message.id,
    conversationId: params.conversationId,
    senderId: params.senderId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };

  // Live-deliver to both sides (Section 9.1).
  publishToMany(participantIds, {
    type: 'message',
    conversationId: params.conversationId,
    message: serialized,
  });

  // Persisted notification for the recipient(s).
  const sender = await prisma.user.findUnique({
    where: { id: params.senderId },
    select: { fullName: true },
  });
  const context = convo.listing?.title ?? convo.job?.title;
  for (const recipientId of participantIds.filter((id) => id !== params.senderId)) {
    await notify({
      userId: recipientId,
      type: 'MESSAGE',
      title: sender?.fullName ?? 'New message',
      body: context ? `${message.body}` : message.body,
      href: `/messages/${params.conversationId}`,
      payload: { conversationId: params.conversationId },
    });
  }

  return serialized;
}

export async function getConversationsForUser(userId: string) {
  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      listing: { select: { id: true, title: true, images: { take: 1, select: { url: true } } } },
      job: { select: { id: true, title: true } },
      participants: {
        include: {
          user: {
            select: { id: true, fullName: true, avatarUrl: true, isVerified: true, lastActiveAt: true },
          },
        },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return convos.map((c) => {
    const me = c.participants.find((p) => p.userId === userId);
    const other = c.participants.find((p) => p.userId !== userId)?.user ?? null;
    const last = c.messages[0] ?? null;
    const unread =
      last && last.senderId !== userId && (!me?.lastReadAt || me.lastReadAt < last.createdAt);
    return {
      id: c.id,
      other,
      listing: c.listing,
      job: c.job,
      lastMessage: last
        ? { body: last.body, createdAt: last.createdAt.toISOString(), fromMe: last.senderId === userId }
        : null,
      unread: Boolean(unread),
    };
  });
}

export async function markConversationRead(conversationId: string, userId: string) {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}
