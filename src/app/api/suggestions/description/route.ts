import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
// Rule-based drafter (also importable client-side for the offline path) —
// src/lib/skills.ts. Used as the fallback when AI isn't configured/available.
import { draftDescription } from '@/lib/skills';
import { aiListingDescription } from '@/lib/ai';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  condition: z.string().trim().max(20).optional(),
  location: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  locale: z.enum(['rw', 'en', 'fr']).optional(),
  kind: z.enum(['PRODUCT', 'SERVICE']).optional(),
});

/**
 * POST /api/suggestions/description — auto-draft a listing description from its
 * attributes. Uses Claude when configured (a genuinely written draft in the
 * seller's language), and transparently falls back to the deterministic
 * rule-based drafter otherwise, so the "Suggest description" button always works.
 */
export const POST = route(async (req: NextRequest) => {
  await requireUser();
  const input = schema.parse(await req.json().catch(() => ({})));
  const ai = await aiListingDescription(input);
  return jsonOk({ description: ai ?? draftDescription(input), source: ai ? 'ai' : 'template' });
});
