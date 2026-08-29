import { describe, it, expect } from 'vitest';
import { isBlockedAddress } from '@/lib/net-guard';

describe('isBlockedAddress (SSRF guard for add-by-URL)', () => {
  it('blocks loopback, private, link-local, CGNAT, reserved, and IPv6 equivalents', () => {
    const blocked = [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '224.0.0.1', // multicast
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      '::ffff:127.0.0.1', // IPv4-mapped loopback must not slip past the v6 branch
    ];
    for (const ip of blocked) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it('allows public addresses (incl. near-miss ranges and IPv4-mapped public)', () => {
    const allowed = [
      '8.8.8.8',
      '1.1.1.1',
      '151.101.1.140',
      '172.15.0.1', // just below the private 172.16–31 block
      '172.32.0.1', // just above it
      '192.167.0.1', // not 192.168
      '93.184.216.34',
      '2606:4700:4700::1111',
      '::ffff:8.8.8.8',
    ];
    for (const ip of allowed) expect(isBlockedAddress(ip), ip).toBe(false);
  });
});
