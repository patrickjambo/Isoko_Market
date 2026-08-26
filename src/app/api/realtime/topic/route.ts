import type { NextRequest } from 'next/server';
import { subscribeTopic, bumpConnections } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Only public item topics may be watched this way. Order topics carry no
// sensitive data (just a status changed → refresh; the detail page re-fetches
// with auth), so cross-side live sync works without leaking order contents.
const ALLOWED = /^(listing|job|order):[a-z0-9]+$/i;

/**
 * Public Server-Sent-Events stream for a single item topic (Section 9.1).
 * Anyone viewing a listing/job opens `/api/realtime/topic?name=listing:<id>`
 * and receives its status changes live, without a page refresh.
 */
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name') ?? '';
  if (!ALLOWED.test(name)) {
    return new Response('Bad topic', { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* closed */
        }
      };
      send(': connected\n\n');
      bumpConnections(1);
      unsubscribe = subscribeTopic(name, (event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });
      heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
    },
    cancel() {
      unsubscribe?.();
      bumpConnections(-1);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
