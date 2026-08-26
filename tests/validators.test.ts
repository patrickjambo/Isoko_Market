import { describe, it, expect } from 'vitest';
import { createListingSchema } from '@/lib/validators/listing';
import { createJobSchema, applyJobSchema } from '@/lib/validators/job';
import { verifyOtpSchema } from '@/lib/validators/auth';

describe('createListingSchema', () => {
  it('accepts a valid listing and coerces price', () => {
    const parsed = createListingSchema.parse({
      title: 'Nice phone',
      description: 'A good phone in great condition.',
      price: '145000',
      location: 'Kigali',
    });
    expect(parsed.price).toBe(145000);
    expect(parsed.condition).toBe('GOOD'); // default
    expect(parsed.images).toEqual([]);
  });

  it('rejects short titles and too many images', () => {
    expect(() =>
      createListingSchema.parse({ title: 'a', description: 'short', price: 1, location: 'K' })
    ).toThrow();
    expect(() =>
      createListingSchema.parse({
        title: 'Valid title',
        description: 'Valid description here',
        price: 1000,
        location: 'Kigali',
        images: Array(7).fill('https://example.com/x.jpg'),
      })
    ).toThrow();
  });
});

describe('createJobSchema', () => {
  it('rejects when max pay is below min pay', () => {
    expect(() =>
      createJobSchema.parse({
        title: 'Rider',
        description: 'Deliver packages around town.',
        location: 'Kigali',
        payMin: 5000,
        payMax: 1000,
      })
    ).toThrow(/Maximum pay/);
  });

  it('accepts a valid gig', () => {
    const job = createJobSchema.parse({
      title: 'Social media helper',
      description: 'Post products and reply to customers.',
      type: 'GIG',
      location: 'Remote',
    });
    expect(job.type).toBe('GIG');
    expect(job.payPeriod).toBe('month');
  });
});

describe('applyJobSchema', () => {
  it('allows an empty cover note', () => {
    expect(applyJobSchema.parse({})).toEqual({});
  });
});

describe('verifyOtpSchema', () => {
  it('requires a valid phone and 6-digit code', () => {
    expect(() => verifyOtpSchema.parse({ phone: '0788123456', code: '12345' })).toThrow();
    const ok = verifyOtpSchema.parse({ phone: '0788123456', code: '123456' });
    expect(ok.code).toBe('123456');
  });
});
