import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { emitAdmin } from '@/lib/admin-realtime';
import { getPlatformSettings } from '@/lib/commission';

/** GET /api/admin/settings/commission — the current commission configuration. */
export const GET = adminRoute('settings.view', async () => {
  const settings = await getPlatformSettings();
  return { data: { settings } };
});

const schema = z.object({
  commissionEnabled: z.boolean().optional(),
  commissionType: z.enum(['PERCENT', 'FIXED']).optional(),
  commissionPercent: z.coerce.number().min(0).max(100).optional(),
  commissionFixed: z.coerce.number().int().min(0).optional(),
  commissionMin: z.coerce.number().int().min(0).optional(),
  commissionMax: z.coerce.number().int().min(0).optional(),
  payoutKind: z.enum(['PHONE', 'MOMO_CODE']).optional(),
  payoutValue: z.string().trim().max(40).optional(),
  // ISO datetime, or null to clear (charge immediately).
  chargingStartsAt: z.string().datetime().nullable().optional(),
  freePeriodDays: z.coerce.number().int().min(0).max(3650).optional(),
});

/**
 * PATCH /api/admin/settings/commission — change the rate, destination, launch
 * date or free period. All from the dashboard; every change is audited.
 */
export const PATCH = adminRoute('settings.manage', async (req, _ctx, { admin }) => {
  const input = schema.parse(await req.json().catch(() => ({})));
  const before = await getPlatformSettings();

  // Merge to validate the resulting state (not just the delta).
  const next = { ...before, ...input };
  if (next.commissionEnabled && !next.payoutValue?.trim()) {
    throw new ApiError('BAD_REQUEST', 'Set a commission destination (phone or MoMo code) before enabling.');
  }
  if (next.commissionMax > 0 && next.commissionMin > next.commissionMax) {
    throw new ApiError('BAD_REQUEST', 'Minimum commission cannot exceed the maximum.');
  }

  const settings = await prisma.platformSettings.update({
    where: { id: before.id },
    data: {
      ...input,
      ...(input.chargingStartsAt !== undefined
        ? { chargingStartsAt: input.chargingStartsAt ? new Date(input.chargingStartsAt) : null }
        : {}),
      updatedById: admin.id,
    },
  });

  const log = await audit({
    actorId: admin.id,
    action: 'settings.commission.update',
    targetType: 'SETTINGS',
    targetId: settings.id,
    before: {
      enabled: before.commissionEnabled,
      type: before.commissionType,
      percent: before.commissionPercent,
      fixed: before.commissionFixed,
    },
    after: {
      enabled: settings.commissionEnabled,
      type: settings.commissionType,
      percent: settings.commissionPercent,
      fixed: settings.commissionFixed,
    },
  });

  await emitAdmin('settings.updated', 'Commission settings updated');

  return { data: { settings }, meta: { audit: log } };
});
