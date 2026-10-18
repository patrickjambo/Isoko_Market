import { describe, it, expect, vi } from 'vitest';
import { broadcastGlobal, subscribeGlobal, type RealtimeEvent } from '@/lib/realtime';

describe('Realtime Global Feature Flag Broadcast', () => {
  it('delivers feature_flags_updated events to global subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeGlobal(handler);

    const event: RealtimeEvent = {
      type: 'feature_flags_updated',
      flags: {
        jobsEnabled: true,
        hiringEnabled: false,
        cvBuilderEnabled: true,
      },
    };

    broadcastGlobal(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);

    unsubscribe();

    // After unsubscribe, no further calls should be received
    broadcastGlobal(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
