'use client';

import { usePollRefresh } from '@/hooks/use-poll-refresh';

/**
 * Drop-in live-refresh for any server-rendered list/detail page: re-fetches the
 * route's data on a visibility-aware interval so status changes (a buyer paying,
 * a seller confirming) appear without a manual refresh — the serverless-safe
 * path where the in-memory SSE bus can't reach the viewer (see usePollRefresh).
 */
export function PollRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  usePollRefresh(intervalMs);
  return null;
}
