import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { previewRestoration } from '@/lib/backup/restore';

const previewSchema = z.object({
  targetScope: z.array(z.string()).optional(),
});

/**
 * POST /api/admin/backups/[id]/restore-preview — Generate diff preview before restoring.
 */
export const POST = adminRoute('backup.restore', async (req, ctx: { params: { id: string } }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = previewSchema.parse(body);

  const preview = await previewRestoration(ctx.params.id, parsed.targetScope);

  return {
    data: preview,
  };
});
