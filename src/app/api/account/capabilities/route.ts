import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFeatureFlags } from '@/lib/feature-flags';

const VALID_CAPABILITIES = [
  'BUYER',
  'SELLER',
  'SERVICE_PROVIDER',
  'HIRER',
  'JOB_SEEKER',
] as const;

type Capability = (typeof VALID_CAPABILITIES)[number];

const schema = z.object({
  capabilities: z.array(z.enum(VALID_CAPABILITIES)).min(1).max(5),
});

/**
 * GET /api/account/capabilities — return the current user's capability list.
 */
export const GET = route(async () => {
  const user = await requireUser();
  // capabilities field added by migration 20261122140000_add_user_capabilities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jsonOk({ capabilities: (user as any).capabilities ?? [] });
});

/**
 * POST /api/account/capabilities
 *
 * Add one or more capabilities to the user's account.
 *
 * Rules:
 * - HIRER / JOB_SEEKER require the job marketplace to be enabled.
 * - ADMIN is never grantable through this endpoint.
 * - Backend enforces feature flags independently of the UI.
 * - Never modifies identity-verification status.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { capabilities } = schema.parse(await req.json().catch(() => ({})));

  const flags = await getFeatureFlags();

  // Check for feature-flag gated capabilities
  const jobsDisabled = !flags.jobsEnabled && !flags.hiringEnabled;
  const hasJobCapability = (capabilities as Capability[]).some(
    (c) => c === 'HIRER' || c === 'JOB_SEEKER'
  );
  if (hasJobCapability && jobsDisabled) {
    throw new ApiError('FORBIDDEN', 'The job marketplace is currently disabled.');
  }
  if (capabilities.includes('HIRER') && !flags.hiringEnabled) {
    throw new ApiError('FORBIDDEN', 'Hiring is currently disabled.');
  }
  if (capabilities.includes('JOB_SEEKER') && !flags.jobsEnabled) {
    throw new ApiError('FORBIDDEN', 'Job seeking is currently disabled.');
  }

  // Merge new capabilities with existing ones (additive — never remove)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: string[] = Array.isArray((user as any).capabilities) ? (user as any).capabilities as string[] : [];
  const merged = Array.from(new Set([...existing, ...capabilities]));

  const updated = await prisma.user.update({
    where: { id: user.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { capabilities: merged } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: { capabilities: true } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jsonOk({ capabilities: (updated as any).capabilities });
});
