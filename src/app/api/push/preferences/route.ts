import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updatePreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
  notifyOrders: z.boolean().optional(),
  notifyListings: z.boolean().optional(),
  notifyJobs: z.boolean().optional(),
  notifySystem: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
  });

  // Return existing or default settings
  return NextResponse.json({
    preferences: prefs || {
      pushEnabled: true,
      notifyMessages: true,
      notifyOrders: true,
      notifyListings: true,
      notifyJobs: true,
      notifySystem: true,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid preferences payload', details: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      pushEnabled: parsed.data.pushEnabled ?? true,
      notifyMessages: parsed.data.notifyMessages ?? true,
      notifyOrders: parsed.data.notifyOrders ?? true,
      notifyListings: parsed.data.notifyListings ?? true,
      notifyJobs: parsed.data.notifyJobs ?? true,
      notifySystem: parsed.data.notifySystem ?? true,
    },
    update: parsed.data,
  });

  return NextResponse.json({
    success: true,
    preferences: updated,
  });
}
