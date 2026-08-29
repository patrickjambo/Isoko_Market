import net from 'node:net';

/**
 * True if an IP address is NOT publicly routable — loopback, private, link-local
 * (incl. 169.254.169.254 cloud metadata), CGNAT, this-network, multicast/reserved,
 * and the IPv6 equivalents. Used to block SSRF when the server fetches a
 * user-supplied image URL. IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is unwrapped and
 * re-checked so it can't smuggle a private v4 address past the v6 branch.
 */
export function isBlockedAddress(ip: string): boolean {
  if (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7))) ip = ip.slice(7);
  if (net.isIPv4(ip)) {
    const parts = ip.split('.');
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 || // this-net, private, loopback, multicast/reserved
      (a === 169 && b === 254) || // link-local (incl. cloud metadata 169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::1' || v6 === '::' || // loopback / unspecified
    v6.startsWith('fc') || v6.startsWith('fd') || // unique-local
    v6.startsWith('fe80') // link-local
  );
}
