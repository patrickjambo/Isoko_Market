/**
 * Robust, cross-device geolocation. A single getCurrentPosition() often returns
 * the FIRST fix the browser has — which on many devices is a coarse network/IP
 * estimate before the GPS warms up (the classic "wrong location"). Instead we
 * WATCH the position and keep the most accurate reading, resolving early once
 * it's precise enough, or returning the best-so-far at a deadline.
 *
 * Works the same on phones (GPS), laptops/tablets (Wi-Fi) and every major
 * browser. Client-only (uses navigator/window).
 */

export type GeoFix = { latitude: number; longitude: number; accuracy: number };

export type GeoErrorReason =
  | 'unsupported' // browser has no geolocation
  | 'insecure' // not an https / secure context (geolocation is blocked)
  | 'denied' // user refused permission
  | 'unavailable' // device could not determine a position
  | 'timeout'; // no fix within the deadline

export class GeoError extends Error {
  reason: GeoErrorReason;
  constructor(reason: GeoErrorReason) {
    super(reason);
    this.name = 'GeoError';
    this.reason = reason;
  }
}

/**
 * Resolve with the most accurate position the device can give.
 * @param desiredAccuracy stop early once the fix is at least this precise (metres)
 * @param maxWait give up watching after this long and return the best reading so far (ms)
 */
export function getAccuratePosition({
  desiredAccuracy = 50,
  maxWait = 15000,
}: { desiredAccuracy?: number; maxWait?: number } = {}): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeoError('unsupported'));
      return;
    }
    // Geolocation is only available in a secure context (https or localhost). On
    // plain http it silently fails, which reads as a "wrong"/absent location.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new GeoError('insecure'));
      return;
    }

    let best: GeoFix | null = null;
    let settled = false;
    let watchId = -1;

    const finish = (err?: GeoError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
      if (best) resolve(best);
      else reject(err ?? new GeoError('unavailable'));
    };

    // Deadline: return the best reading gathered so far (or fail if none).
    const timer = setTimeout(() => finish(new GeoError('timeout')), maxWait);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        // Keep the tightest (smallest accuracy radius) reading seen.
        if (!best || fix.accuracy < best.accuracy) best = fix;
        // Precise enough — no need to keep the GPS running.
        if (fix.accuracy <= desiredAccuracy) finish();
      },
      (err) => {
        // Permission denial is terminal. Other errors only fail if we have
        // nothing yet — otherwise we keep whatever fix we already gathered.
        if (err.code === err.PERMISSION_DENIED) {
          best = null;
          finish(new GeoError('denied'));
        } else if (!best) {
          finish(new GeoError(err.code === err.TIMEOUT ? 'timeout' : 'unavailable'));
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
    );
  });
}

/** Map a GeoError reason to a `common` i18n key. */
export function geoErrorKey(err: unknown): string {
  const reason = err instanceof GeoError ? err.reason : 'unavailable';
  switch (reason) {
    case 'unsupported':
      return 'geoUnsupported';
    case 'insecure':
      return 'geoInsecure';
    case 'denied':
      return 'geoDenied';
    case 'timeout':
      return 'geoTimeout';
    default:
      return 'geoError';
  }
}
