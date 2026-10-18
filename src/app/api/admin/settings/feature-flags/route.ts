import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { emitAdmin } from '@/lib/admin-realtime';
import { broadcastGlobal } from '@/lib/realtime';
import { getPlatformSettings } from '@/lib/commission';

/** GET /api/admin/settings/feature-flags — current feature flag state. */
export const GET = adminRoute('settings.view', async () => {
  const s = await getPlatformSettings();
  return {
    data: {
      jobsEnabled: s.jobsEnabled,
      hiringEnabled: s.hiringEnabled,
      cvBuilderEnabled: s.cvBuilderEnabled,
    },
  };
});

const schema = z.object({
  jobsEnabled: z.boolean().optional(),
  hiringEnabled: z.boolean().optional(),
  cvBuilderEnabled: z.boolean().optional(),
});

/**
 * PATCH /api/admin/settings/feature-flags — toggle features on/off.
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
    action: 'settings.feature_flags.update',
    targetType: 'SETTINGS',
    targetId: settings.id,
    before: {
      jobsEnabled: before.jobsEnabled,
      hiringEnabled: before.hiringEnabled,
      cvBuilderEnabled: before.cvBuilderEnabled,
    },
    after: {
      jobsEnabled: settings.jobsEnabled,
      hiringEnabled: settings.hiringEnabled,
      cvBuilderEnabled: settings.cvBuilderEnabled,
    },
  });

  await emitAdmin('settings.updated', 'Feature flags updated');

  // Broadcast to all active client connections (both logged-in and guests)
  broadcastGlobal({
    type: 'feature_flags_updated',
    flags: {
      jobsEnabled: settings.jobsEnabled,
      hiringEnabled: settings.hiringEnabled,
      cvBuilderEnabled: settings.cvBuilderEnabled,
    },
  });

  // Revalidate Server Components across all routes and locales
  revalidatePath('/', 'layout');

  return {
    data: {
      jobsEnabled: settings.jobsEnabled,
      hiringEnabled: settings.hiringEnabled,
      cvBuilderEnabled: settings.cvBuilderEnabled,
    },
  };
});
