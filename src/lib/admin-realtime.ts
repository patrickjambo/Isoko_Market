import 'server-only';
import { prisma } from './prisma';
import { publishToMany, type RealtimeEvent } from './realtime';

/**
 * Broadcast a live event to every admin's personal realtime channel, so the
 * moderation/verification queues, dashboard counters and the activity ticker
 * update the moment something happens — no refresh (Section: Real-time sync).
 * Admins are few, so a lightweight lookup per event is fine.
 */
export async function broadcastToAdmins(event: RealtimeEvent): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', accountStatus: 'ACTIVE' },
    select: { id: true },
  });
  publishToMany(
    admins.map((a) => a.id),
    event
  );
}

/**
 * Emit a named admin event, e.g. emitAdmin('report.created', '…'). Maps to the
 * spec's `admin:report.created` / `admin:verification.pending` /
 * `admin:transaction.completed` channel semantics.
 */
export async function emitAdmin(name: string, label: string): Promise<void> {
  await broadcastToAdmins({
    type: 'admin_event',
    name,
    label,
    at: new Date().toISOString(),
  });
}
