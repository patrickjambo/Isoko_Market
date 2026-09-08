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

/**
 * Best-effort human label for coordinates (free, keyless, works worldwide).
 * Most specific place first, then region and country, de-duped. Used by BOTH
 * "Use my location" and the map pin so the shown name always matches the pin.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return undefined;
    const j = await res.json();
    return (
      [...new Set([j.locality || j.city, j.principalSubdivision, j.countryName].filter(Boolean))].join(
        ', '
      ) || undefined
    );
  } catch {
    return undefined;
  }
}

export type PlaceResult = { latitude: number; longitude: number; label: string };

/** Join parts into a place label, dropping blanks and case-insensitive repeats. */
function dedupeLabel(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const v = part?.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.join(', ');
}

/**
 * Search a place by name (forward geocoding) so users who can't read a map just
 * TYPE their area — "Kimironko", "Nyabugogo" — and pick it. Photon (OpenStreetMap)
 * is free, keyless, typo-tolerant and CORS-friendly. Biased toward Rwanda but not
 * restricted, so someone abroad still finds their place.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=-1.94&lon=29.87`
    );
    if (!res.ok) return [];
    const j = await res.json();
    const feats: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, string> }> =
      j.features ?? [];
    return feats
      .map((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords) return null;
        const [lng, lat] = coords;
        const p = f.properties ?? {};
        // Case-insensitive de-dupe (Photon often repeats the country in two fields).
        const label = dedupeLabel([p.name, p.district || p.city || p.county, p.state, p.country]);
        return label ? { latitude: lat, longitude: lng, label } : null;
      })
      .filter((r): r is PlaceResult => r !== null);
  } catch {
    return [];
  }
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
