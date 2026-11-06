import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { emitAdmin } from '@/lib/admin-realtime';
import { broadcastGlobal } from '@/lib/realtime';
import type { SubscriptionSettings } from '@/lib/realtime';
import { getPlatformSettings } from '@/lib/commission';

/** GET /api/admin/settings/subscription — current subscription settings. */
export const GET = adminRoute('settings.view', async () => {
  const s = await getPlatformSettings();
  return {
    data: {
      subscriptionEnabled: s.subscriptionEnabled,
      subscriptionMonthlyPrice: s.subscriptionMonthlyPrice,
      subscriptionAnnualPrice: s.subscriptionAnnualPrice,
      subscriptionMomoNumber: s.subscriptionMomoNumber,
      subscriptionMomoKind: s.subscriptionMomoKind,
      subscriptionRequireOnPublish: s.subscriptionRequireOnPublish,
      subscriptionAutoExpireMonths: s.subscriptionAutoExpireMonths,
      subscriptionAutoExpireListings: s.subscriptionAutoExpireListings,
    } satisfies SubscriptionSettings,
  };
});

const schema = z.object({
  subscriptionEnabled: z.boolean().optional(),
  subscriptionMonthlyPrice: z.number().int().min(0).optional(),
  subscriptionAnnualPrice: z.number().int().min(0).optional(),
  subscriptionMomoNumber: z.string().optional(),
  subscriptionMomoKind: z.enum(['PHONE', 'MOMO_CODE']).optional(),
  subscriptionRequireOnPublish: z.boolean().optional(),
  subscriptionAutoExpireMonths: z.number().int().min(0).optional(),
  subscriptionAutoExpireListings: z.number().int().min(0).optional(),
});

/**
 * PATCH /api/admin/settings/subscription — update subscription settings.
 * Every change is audited. The UI reads these flags and hides/shows sections
 * without any code deployment.
 */
export const PATCH = adminRoute('settings.manage', async (req, _ctx, { admin }) => {
  const input = schema.parse(await req.json().catch(() => ({})));
  const before = await getPlatformSettings();

  const settings = await prisma.platformSettings.update({
    where: { id: before.id },
    data: { ...input, updatedById: admin.id },
  });

  await audit({
    actorId: admin.id,
    action: 'settings.subscription.update',
    targetType: 'SETTINGS',
    targetId: settings.id,
    before: {
      subscriptionEnabled: before.subscriptionEnabled,
      subscriptionMonthlyPrice: before.subscriptionMonthlyPrice,
      subscriptionAnnualPrice: before.subscriptionAnnualPrice,
      subscriptionMomoNumber: before.subscriptionMomoNumber,
      subscriptionMomoKind: before.subscriptionMomoKind,
      subscriptionRequireOnPublish: before.subscriptionRequireOnPublish,
      subscriptionAutoExpireMonths: before.subscriptionAutoExpireMonths,
      subscriptionAutoExpireListings: before.subscriptionAutoExpireListings,
    },
    after: {
      subscriptionEnabled: settings.subscriptionEnabled,
      subscriptionMonthlyPrice: settings.subscriptionMonthlyPrice,
      subscriptionAnnualPrice: settings.subscriptionAnnualPrice,
      subscriptionMomoNumber: settings.subscriptionMomoNumber,
      subscriptionMomoKind: settings.subscriptionMomoKind,
      subscriptionRequireOnPublish: settings.subscriptionRequireOnPublish,
      subscriptionAutoExpireMonths: settings.subscriptionAutoExpireMonths,
      subscriptionAutoExpireListings: settings.subscriptionAutoExpireListings,
    },
  });

  await emitAdmin('settings.updated', 'Subscription settings updated');

  const updatedSettings: SubscriptionSettings = {
    subscriptionEnabled: settings.subscriptionEnabled,
    subscriptionMonthlyPrice: settings.subscriptionMonthlyPrice,
    subscriptionAnnualPrice: settings.subscriptionAnnualPrice,
    subscriptionMomoNumber: settings.subscriptionMomoNumber,
    subscriptionMomoKind: settings.subscriptionMomoKind,
    subscriptionRequireOnPublish: settings.subscriptionRequireOnPublish,
    subscriptionAutoExpireMonths: settings.subscriptionAutoExpireMonths,
    subscriptionAutoExpireListings: settings.subscriptionAutoExpireListings,
  };

  // Broadcast to all active client connections
  broadcastGlobal({
    type: 'subscription_settings_updated',
    settings: updatedSettings,
  });

  // Revalidate Server Components across all routes and locales
  revalidatePath('/', 'layout');

  return { data: updatedSettings };
});
