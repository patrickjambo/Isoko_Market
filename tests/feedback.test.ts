import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const feedbackSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  comment: z.string().trim().min(5, 'Comment must be at least 5 characters').max(500),
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

  it('defaults rating to 5 if omitted', () => {
    const input = {
      name: 'Jean Claude',
      comment: 'Very reliable and safe marketplace.',
    };
    const parsed = feedbackSchema.parse(input);
    expect(parsed.rating).toBe(5);
  });

  it('rejects too short name or comment', () => {
    expect(feedbackSchema.safeParse({ name: 'A', comment: 'Good' }).success).toBe(false);
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
