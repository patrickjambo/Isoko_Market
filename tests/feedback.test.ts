import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const feedbackSchema = z.object({
  name: z.string().trim().max(60).optional().nullable(),
  comment: z.string().trim().min(2, 'Comment must be at least 2 characters').max(500),
  rating: z.number().int().min(1).max(5).default(5),
});

describe('Landing feedback validation', () => {
  it('accepts valid feedback with custom rating', () => {
    const valid = {
      name: 'Uwase Aline',
      comment: 'Zenova helped me find the best deals in Kigali!',
      rating: 5,
    };
    const parsed = feedbackSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('allows omitting name for logged-in users', () => {
    const withoutName = {
      comment: 'Excellent buying and selling experience!',
      rating: 5,
    };
    const parsed = feedbackSchema.safeParse(withoutName);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBeUndefined();
    }
  });

  it('defaults rating to 5 if omitted', () => {
    const input = {
      name: 'Jean Claude',
      comment: 'Very reliable and safe marketplace for buying goods.',
    };
    const parsed = feedbackSchema.parse(input);
    expect(parsed.rating).toBe(5);
  });

  it('rejects too short comment', () => {
    expect(feedbackSchema.safeParse({ name: 'User', comment: 'A' }).success).toBe(false);
  });

  it('rejects invalid star rating outside 1..5', () => {
    expect(
      feedbackSchema.safeParse({
        name: 'Valid Name',
        comment: 'Valid comment text here',
        rating: 6,
      }).success
    ).toBe(false);

    expect(
      feedbackSchema.safeParse({
        name: 'Valid Name',
        comment: 'Valid comment text here',
        rating: 0,
      }).success
    ).toBe(false);
  });
});
