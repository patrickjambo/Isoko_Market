import { getCurrentUser } from '@/lib/auth';
import {
  subscribe,
  subscribeGlobal,
  markConnected,
  markDisconnected,
  bumpConnections,
} from '@/lib/realtime';

// This stream must stay open — never statically optimized or cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream for the browser (Section 9.1). Logged-in users receive
 * their personal notifications/messages/updates, and all clients (including guests)
 * receive global platform events (like feature flag toggles) so UI updates
 * seamlessly in real time without manual page refresh.
 */
export async function GET() {
  const user = await getCurrentUser();

  const encoder = new TextEncoder();
  let unsubscribeUser: (() => void) | null = null;
  let unsubscribeGlobal: (() => void) | null = null;
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
      if (user) {
        markConnected(user.id); // presence — drives SMS-fallback decisions
      }
      bumpConnections(1);

      if (user) {
        unsubscribeUser = subscribe(user.id, (event) => {
          send(`data: ${JSON.stringify(event)}\n\n`);
        });
      }

      unsubscribeGlobal = subscribeGlobal((event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Heartbeat keeps intermediaries from closing an idle connection.
      heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
    },
    cancel() {
      unsubscribeUser?.();
      unsubscribeGlobal?.();
      if (user) {
        markDisconnected(user.id);
      }
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
