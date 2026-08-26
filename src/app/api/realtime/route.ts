import { getCurrentUser } from '@/lib/auth';
import { subscribe, markConnected, markDisconnected, bumpConnections } from '@/lib/realtime';

// This stream must stay open — never statically optimized or cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream for the logged-in user (Section 9.1). The browser's
 * EventSource auto-reconnects, which satisfies the "polling fallback if the
 * socket drops" requirement without extra code.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
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
          /* stream already closed */
        }
      };

      // Initial comment opens the stream immediately.
      send(': connected\n\n');
      markConnected(user.id); // presence — drives SMS-fallback decisions
      bumpConnections(1);

      unsubscribe = subscribe(user.id, (event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Heartbeat keeps intermediaries from closing an idle connection.
      heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
    },
    cancel() {
      unsubscribe?.();
      markDisconnected(user.id);
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
