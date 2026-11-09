import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';
import { publish } from '@/lib/realtime';
import { audit } from '@/lib/audit';

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'resubmit']),
  reason: z.string().trim().max(500).optional(),
  verifiedFullName: z.string().trim().max(100).optional(),
  verifiedIdNumber: z.string().trim().max(50).optional(),
  verifiedCountry: z.string().trim().max(50).optional(),
});

/**
 * GET /api/admin/verifications/[id] — Retrieve detailed verification request with OCR info.
 */
export const GET = adminRoute('verification.view', async (_req, ctx: { params: { id: string } }) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: ctx.params.id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          location: true,
          avatarUrl: true,
          accountStatus: true,
          createdAt: true,
          isVerified: true,
          verificationStatus: true,
          nationalId: true,
          country: true,
        },
      },
      reviewedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  if (!request) {
    throw new ApiError('NOT_FOUND', 'Verification request not found.');
  }

  return {
    data: request,
  };
});

/**
 * PATCH /api/admin/verifications/[id] — Trust team reviews, approves, rejects,
 * or requests resubmission of an ID document.
 */
export const PATCH = adminRoute(
  null,
  async (req, ctx: { params: { id: string } }, { admin, permissions }) => {
    const body = await req.json().catch(() => ({}));
    const { decision, reason, verifiedFullName, verifiedIdNumber, verifiedCountry } =
      decisionSchema.parse(body);

    const requiredPerm =
      decision === 'approve'
        ? 'verification.approve'
        : decision === 'resubmit'
          ? 'verification.resubmit'
          : 'verification.reject';

    if (!permissions.has(requiredPerm) && !permissions.has('*')) {
      // Allow verification.reject to also cover resubmit if specific perm not granted
      if (decision === 'resubmit' && permissions.has('verification.reject')) {
        // permitted
      } else {
        throw new ApiError('FORBIDDEN', `Missing permission: ${requiredPerm}`);
      }
    }

    const request = await prisma.verificationRequest.findUnique({
      where: { id: ctx.params.id },
      include: { user: true },
    });

    if (!request) {
      throw new ApiError('NOT_FOUND', 'Verification request not found.');
    }

    const approved = decision === 'approve';
    const resubmit = decision === 'resubmit';
    const status = approved ? 'VERIFIED' : 'REJECTED';

    const now = new Date();
    const finalNationalId =
      verifiedIdNumber?.replace(/\s+/g, '') ||
      request.extractedIdNumber?.replace(/\s+/g, '') ||
      request.user.nationalId;
    const finalCountry = verifiedCountry || request.extractedCountry || request.user.country || 'Rwanda';
    const finalFullName = verifiedFullName || request.extractedFullName || request.user.fullName;

    // Database updates in atomic transaction
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewNote: reason || (resubmit ? 'Please upload a clearer copy of your ID document.' : null),
          reviewedById: admin.id,
          reviewedAt: now,
          extractedFullName: finalFullName,
          extractedIdNumber: finalNationalId,
          extractedCountry: finalCountry,
        },
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: {
          isVerified: approved,
          verificationStatus: status,
          ...(approved
            ? {
                nationalId: finalNationalId,
                country: finalCountry,
                verifiedAt: now,
              }
            : {}),
        },
      }),
    ]);

    const auditAction =
      decision === 'approve'
        ? 'verification.approve'
        : decision === 'resubmit'
          ? 'verification.resubmit'
          : 'verification.reject';

    const log = await audit({
      actorId: admin.id,
      action: auditAction,
      targetType: 'USER',
      targetId: request.userId,
      reason: reason || (resubmit ? 'Requested re-upload of ID document' : `ID verification ${decision}`),
      after: {
        verificationStatus: status,
        nationalId: approved ? finalNationalId : undefined,
        country: approved ? finalCountry : undefined,
      },
    });

    // Notify user
    const notifTitle = approved
      ? 'Identity verified successfully'
      : resubmit
        ? 'ID re-upload requested'
        : 'Verification needs attention';

    const notifBody =
      reason ||
      (approved
        ? 'Your National ID has been verified by the Zenova trust team. You now have a verified badge!'
        : resubmit
          ? 'Please upload a clearer, uncropped photo of your National ID card to complete verification.'
          : 'Your identity document could not be approved at this time.');

    await notify({
      userId: request.userId,
      type: approved ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      title: notifTitle,
      body: notifBody,
      href: '/verify',
    });

    // Real-time update to user's active session
    publish(request.userId, { type: 'verification_updated', status });

    // Broadcast to other admins
    await emitAdmin(
      `verification.${decision}`,
      `Verification for ${request.user.fullName} ${
        approved ? 'approved' : resubmit ? 'marked for re-upload' : 'rejected'
      }`
    );

    return {
      data: {
        status,
        decision,
        nationalId: approved ? finalNationalId : null,
        country: approved ? finalCountry : null,
      },
      meta: { audit: log },
    };
  }
);
