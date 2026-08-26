import 'server-only';
import { EventEmitter } from 'node:events';

/**
 * Real-time transport abstraction (Section 9.1). The default driver is an
 * in-process pub/sub bus consumed by an SSE endpoint (/api/realtime), so live
 * chat, notification badges and status updates work with zero external
 * services. In a multi-instance production deploy, implement this same
 * publish() against Pusher/Ably and point clients at that channel — the event
 * shapes below stay identical.
 */
export type RealtimeEvent =
  | { type: 'message'; conversationId: string; message: SerializedMessage }
  | { type: 'message_read'; conversationId: string; readerId: string }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'notification'; notification: SerializedNotification }
  | { type: 'application_update'; applicationId: string; status: string }
  // Status change on a tracked entity, broadcast to its topic + affected users.
  // `entity` + `id` replace the old (mislabeled) `listingId` field, which used
  // to carry a job/order id despite its name. `reason` disambiguates otherwise
  // identical transitions (e.g. a job going CLOSED because it was `filled` vs.
  // manually `closed`).
  | {
      type: 'entity_update';
      entity: 'listing' | 'job' | 'order';
      id: string;
      status: string;
      reason?: string; // sold | filled | closed | reopened | cancelled | relisted
    }
  | { type: 'admin_event'; name: string; label: string; at: string };

export type SerializedMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type SerializedNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
};

// Survive Next.js hot reloads by stashing the emitter on globalThis.
const globalForBus = globalThis as unknown as {
  __isokoBus?: EventEmitter;
  __isokoOnline?: Map<string, number>;
};
const bus = globalForBus.__isokoBus ?? new EventEmitter();
bus.setMaxListeners(0);
if (process.env.NODE_ENV !== 'production') globalForBus.__isokoBus = bus;

// Live presence: how many SSE connections each user currently holds. Used to
// decide whether to fall back to SMS for offline users (Section 6.5).
const online = globalForBus.__isokoOnline ?? new Map<string, number>();
if (process.env.NODE_ENV !== 'production') globalForBus.__isokoOnline = online;

const channel = (userId: string) => `user:${userId}`;

/** Mark a user's realtime connection as opened. */
export function markConnected(userId: string): void {
  online.set(userId, (online.get(userId) ?? 0) + 1);
}

/** Mark a user's realtime connection as closed. */
export function markDisconnected(userId: string): void {
  const next = (online.get(userId) ?? 1) - 1;
  if (next <= 0) online.delete(userId);
  else online.set(userId, next);
}

/** True if the user currently has at least one open realtime connection. */
export function isOnline(userId: string): boolean {
  return (online.get(userId) ?? 0) > 0;
}

// Global gauge of all open SSE streams (user + topic) for the System Health card.
const globalForConn = globalThis as unknown as { __isokoConns?: { n: number } };
const conns = globalForConn.__isokoConns ?? { n: 0 };
if (process.env.NODE_ENV !== 'production') globalForConn.__isokoConns = conns;

export function bumpConnections(delta: number): void {
  conns.n = Math.max(0, conns.n + delta);
}

export function connectionCount(): number {
  return conns.n;
}

/** Publish an event to a specific user's channel. */
export function publish(userId: string, event: RealtimeEvent): void {
  bus.emit(channel(userId), event);
}

/** Publish the same event to several users (e.g. both chat participants). */
export function publishToMany(userIds: string[], event: RealtimeEvent): void {
  for (const id of userIds) publish(id, event);
}

/** Subscribe to a user's channel. Returns an unsubscribe function. */
export function subscribe(
  userId: string,
  handler: (event: RealtimeEvent) => void
): () => void {
  bus.on(channel(userId), handler);
  return () => bus.off(channel(userId), handler);
}

// ── Topic channels ──────────────────────────────────────────
// User channels are private (one per account). Topic channels are shared and
// used to broadcast an item's changes to *anyone currently viewing it*, e.g.
// `listing:<id>` or `job:<id>` — satisfying Section 9.1 (status changes
// propagate to viewers).
const topicChannel = (topic: string) => `topic:${topic}`;

export function publishTopic(topic: string, event: RealtimeEvent): void {
  bus.emit(topicChannel(topic), event);
}

export function subscribeTopic(
  topic: string,
  handler: (event: RealtimeEvent) => void
): () => void {
  bus.on(topicChannel(topic), handler);
  return () => bus.off(topicChannel(topic), handler);
}
