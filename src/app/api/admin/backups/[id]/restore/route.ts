import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { executeRestoration } from '@/lib/backup/restore';

const restoreSchema = z.object({
  targetScope: z.array(z.string()).optional(),
  notes: z.string().max(250).optional(),
  skipSafetySnapshot: z.boolean().default(false),
  confirmText: z.string(),
});

/**
 * POST /api/admin/backups/[id]/restore — Execute safe restoration.
 */
export const POST = adminRoute('backup.restore', async (req, ctx: { params: { id: string } }, { admin }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = restoreSchema.parse(body);

  if (parsed.confirmText !== 'RESTORE') {
    return new Response(
      JSON.stringify({ error: 'Please confirm by typing RESTORE before executing.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = await executeRestoration({
    backupId: ctx.params.id,
    targetScope: parsed.targetScope,
    performedById: admin.id,
    notes: parsed.notes,
    skipSafetySnapshot: parsed.skipSafetySnapshot,
  });

  return {
    data: result,
  };
});
