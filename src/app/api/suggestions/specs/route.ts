import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { aiSuggestSpecs } from '@/lib/ai';
import { suggestSpecs } from '@/lib/specs';

const schema = z.object({
  title: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(80).optional(),
  categorySlug: z.string().trim().max(60).optional(),
});

/**
 * POST /api/suggestions/specs — feature labels tailored to the product the seller
 * is entering. AI first (specific to the exact item), falling back to the
 * keyword/category map so it always returns something relevant and never blocks.
 */
export const POST = route(async (req: NextRequest) => {
  await requireUser();
  const { title, category, categorySlug } = schema.parse(await req.json().catch(() => ({})));

  const ai = title.trim().length >= 3 ? await aiSuggestSpecs({ title, category }) : null;
  const specs = ai ?? suggestSpecs(title, categorySlug);
  return jsonOk({ specs, source: ai ? 'ai' : 'rules' });
});
