import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { verifyOtpSchema } from '@/lib/validators/auth';
import { normalizeRwandaPhone } from '@/lib/phone';
import { consumeOtp } from '@/lib/otp-service';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { toSessionUser } from '@/lib/serialize';
import { uniqueReferralCode, applyReferral } from '@/lib/referral';
import { emitAdmin } from '@/lib/admin-realtime';
import { intentToRole, intentHome, landingFor } from '@/lib/onboarding';

export const POST = route(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const input = verifyOtpSchema.parse(body);
  const phone = normalizeRwandaPhone(input.phone)!;

  // Verifying the OTP proves ownership of the phone — this both logs in existing
  // users and confirms the number for new registrations.
  await consumeOtp(phone, input.code, 'login');

  const existing = await prisma.user.findUnique({ where: { phone } });

  // Intent (from the "Get Started" fork) decides the role written — but the
  // explicit role select, if any, wins (Visitor spec §8).
  const role = input.role ?? (input.intent ? intentToRole(input.intent) : 'BUYER');

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        phone,
        fullName: input.fullName?.trim() || 'Isoko user',
        role,
        preferredRole: input.intent ?? null,
        locale: input.locale ?? 'rw',
        referralCode: await uniqueReferralCode(),
        lastActiveAt: new Date(),
      },
    }));

  // Apply a referral only for brand-new registrations that supplied a code.
  if (!existing && input.ref) {
    await applyReferral(user.id, input.ref);
  }
  if (!existing) {
    // Create the contextual record the chosen path needs, so the very next
    // screen always has something to attach to — no null-state race (§8).
    if (input.intent === 'find_work') {
      await prisma.cV.create({
        data: {
          userId: user.id,
          structuredData: { headline: '', summary: '', education: [], experience: [], skills: [], skillLevels: {}, languages: [] },
        },
      });
    }
    await emitAdmin('signup', `${user.fullName} joined`);
  }

  await createSession({ userId: user.id, role: user.role, v: user.sessionVersion });

  // Role-aware landing: a NEW user goes to their onboarding first-screen (intent
  // based); a RETURNING user opens on their own role home (bug fix — login used
  // to always route to '/'). The client still honours an explicit returnTo.
  const redirectTo = existing ? landingFor(user) : intentHome(input.intent);

  return jsonOk({ user: toSessionUser(user), isNew: !existing, intent: input.intent ?? null, redirectTo });
});
