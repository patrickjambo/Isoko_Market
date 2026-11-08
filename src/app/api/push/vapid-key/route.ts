import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
}
