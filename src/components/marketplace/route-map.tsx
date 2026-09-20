'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Polyline, Marker } from 'leaflet';
import { Navigation, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getAccuratePosition } from '@/lib/geolocation';
import { Button } from '@/components/ui/button';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Product-location map with on-demand routing (free OpenStreetMap tiles + the
 * public OSRM router — no API key). Shows the product pin; "Route from my
 * location" gets the buyer's GPS, draws the driving path, and shows distance/time.
 *
 * COORDINATE ORDER (the classic trap): Leaflet is [lat, lng]; OSRM's URL and its
 * returned GeoJSON geometry are [lng, lat]. We convert explicitly at each edge —
 * never pass one where the other is expected.
 */
export function RouteMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const t = useTranslations('marketplace');
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const route = useRef<Polyline | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ km: number; mins: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      // Leaflet takes [lat, lng].
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);
      const pin = L.divIcon({
        className: '',
        html:
          '<div style="width:26px;height:26px;transform:translate(-50%,-100%)">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" fill="#0b6b62" stroke="#fff" stroke-width="1.5">' +
          '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
          '<circle cx="12" cy="9" r="2.5" fill="#fff"/></svg></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([lat, lng], { icon: pin }).addTo(m).bindPopup(escapeHtml(title));
      map.current = m;
      setTimeout(() => m.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [lat, lng, title]);

  async function showRoute() {
    setLoading(true);
    setError(null);
    try {
      const fix = await getAccuratePosition();
      const L = (await import('leaflet')).default;
      const m = map.current;
      if (!m) return;

      // OSRM wants {lng},{lat};{lng},{lat} in the URL.
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${fix.longitude},${fix.latitude};${lng},${lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      const r = data?.routes?.[0];
      if (!r) throw new Error('no-route');

      // OSRM geometry coords are [lng, lat] → flip to [lat, lng] for Leaflet.
      const line: [number, number][] = r.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      route.current?.remove();
      route.current = L.polyline(line, { color: '#0b6b62', weight: 5, opacity: 0.85 }).addTo(m);

      meMarker.current?.remove();
      meMarker.current = L.marker([fix.latitude, fix.longitude])
        .addTo(m)
        .bindPopup(t('yourLocation'));

      m.fitBounds(route.current.getBounds(), { padding: [40, 40] });
      setInfo({ km: r.distance / 1000, mins: Math.max(1, Math.round(r.duration / 60)) });
    } catch {
      setError(t('routeError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={el}
        className="isolate h-72 w-full overflow-hidden rounded-xl border border-border"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={showRoute} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {t('routeFromMe')}
        </Button>
        {info && (
          <span className="text-sm font-medium text-muted-foreground">
            {info.km.toFixed(1)} km · {info.mins} min
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
