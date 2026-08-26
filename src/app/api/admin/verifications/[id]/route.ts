import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';
import { audit } from '@/lib/audit';

const schema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/admin/verifications/[id] — trust team approves/rejects an ID.
 * Permission depends on the decision; the action is audited and the applicant
 * is notified live.
 */
export const PATCH = adminRoute(
  null,
  async (req, ctx: { params: { id: string } }, { admin, permissions }) => {
    const { decision, reason } = schema.parse(await req.json().catch(() => ({})));
    const key = decision === 'approve' ? 'verification.approve' : 'verification.reject';
    if (!permissions.has(key)) throw new ApiError('FORBIDDEN', `Missing permission: ${key}`);

    const request = await prisma.verificationRequest.findUnique({ where: { id: ctx.params.id } });
    if (!request) throw new ApiError('NOT_FOUND', 'Verification request not found.');

    const approved = decision === 'approve';
    const status = approved ? 'VERIFIED' : 'REJECTED';

    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: request.id },
        data: { status, reviewNote: reason, reviewedById: admin.id, reviewedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: { isVerified: approved, verificationStatus: status },
      }),
    ]);

    const log = await audit({
      actorId: admin.id,
      action: key,
      targetType: 'USER',
      targetId: request.userId,
      reason,
      after: { verificationStatus: status },
    });

    await notify({
      userId: request.userId,
      type: approved ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      title: approved ? 'Verification approved' : 'Verification needs attention',
      body: reason,
      href: '/verify',
    });

    // Broadcast the decision to other admins' consoles (rule 6 gap: previously
    // only the "pending" submission was broadcast, not the approve/reject).
    await emitAdmin(
      approved ? 'verification.approved' : 'verification.rejected',
      `Verification ${approved ? 'approved' : 'rejected'}`
    );

    return { data: { status }, meta: { audit: log } };
  }
);
