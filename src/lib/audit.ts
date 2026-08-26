import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type AuditEntry = {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

/**
 * Append an immutable audit record. Every mutating admin action calls this; the
 * created row is returned so the API can echo it back ("action logged").
 */
export async function audit(entry: AuditEntry) {
  const row = await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      before: entry.before,
      after: entry.after,
    },
  });
  return {
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  };
}
