import { route, jsonOk } from '@/lib/api';
import { destroySession } from '@/lib/session';

export const POST = route(async () => {
  destroySession();
  return jsonOk({ ok: true });
});
