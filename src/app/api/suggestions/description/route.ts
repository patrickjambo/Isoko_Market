import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
// Thin wrapper over the ONE shared pure drafter (also importable client-side for
// the offline path) — src/lib/skills.ts. No second implementation.
import { draftDescription } from '@/lib/skills';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  condition: z.string().trim().max(20).optional(),
  location: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  locale: z.enum(['rw', 'en', 'fr']).optional(),
});

/** POST /api/suggestions/description — editable auto-draft from attributes. */
export const POST = route(async (req: NextRequest) => {
  await requireUser();
  const input = schema.parse(await req.json().catch(() => ({})));
  return jsonOk({ description: draftDescription(input) });
});
