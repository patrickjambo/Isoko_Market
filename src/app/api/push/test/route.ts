import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendTestPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendTestPush(user.id);

  if (result.sent === 0) {
    return NextResponse.json({
      success: false,
      message: 'No active device subscriptions found. Please enable push notifications on your device first.',
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    message: 'Test notification sent to your device!',
  });
}
