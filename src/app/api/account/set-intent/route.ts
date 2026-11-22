import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isIntent, intentHome } from '@/lib/onboarding';
import { getFeatureFlags } from '@/lib/feature-flags';

const schema = z.object({
  intent: z.string(),
});

/**
 * POST /api/account/set-intent
 *
 * Saves the onboarding intent chosen by a Google-authenticated user on the
 * /welcome page. This mirrors what the OTP registration flow does via
 * verify-otp/route.ts when a user completes registration.
 *
 * Rules:
 * - Only valid intents are accepted.
 * - Hire / find_work intents are blocked when their feature flags are disabled.
 * - Never modifies identity-verification status.
 * - Never grants ADMIN role.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { intent } = schema.parse(await req.json().catch(() => ({})));

  if (!isIntent(intent)) {
    throw new ApiError('BAD_REQUEST', 'Invalid intent.');
  }

  const flags = await getFeatureFlags();

  // Guard feature-flag gated intents — backend must enforce, not just UI
  if (intent === 'hire' && !flags.hiringEnabled) {
    throw new ApiError('FORBIDDEN', 'Hiring is currently unavailable.');
  }
  if (intent === 'find_work' && !flags.jobsEnabled && !flags.cvBuilderEnabled) {
    throw new ApiError('FORBIDDEN', 'Job seeking is currently unavailable.');
  }

  // Persist the chosen intent; role stays BUYER unless it's the hire intent
  // (matching exactly what verify-otp/route.ts does for OTP users).
  const newRole = intent === 'hire' ? 'EMPLOYER' : user.role;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferredRole: intent,
      // Upgrade to EMPLOYER only if still a plain BUYER (never downgrade)
      ...(newRole !== user.role ? { role: newRole } : {}),
    },
  });

  // Create a blank CV for job-seekers so their first screen has something to attach to
  if (intent === 'find_work') {
    const existing = await prisma.cV.findFirst({ where: { userId: user.id } });
    if (!existing) {
      await prisma.cV.create({
        data: {
          userId: user.id,
          structuredData: {
            headline: '',
            summary: '',
            education: [],
            experience: [],
            skills: [],
            skillLevels: {},
            languages: [],
          },
        },
      });
    }
  }

  const redirectTo = intentHome(intent, flags);
  return jsonOk({ ok: true, redirectTo });
});
