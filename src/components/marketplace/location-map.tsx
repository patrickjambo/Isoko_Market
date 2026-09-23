'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { Navigation } from 'lucide-react';
import { useTranslations } from 'next-intl';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Shows WHERE a product/service is — a Leaflet map (free OpenStreetMap tiles) with
 * the exact pin, plus a "Get directions" button that hands off to Google Maps for
 * real turn-by-turn navigation. We show the pin (context); Google does the driving.
 */
export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const t = useTranslations('marketplace');
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);
      const pin = L.divIcon({
        className: '',
        html:
          '<div style="width:28px;height:28px;transform:translate(-50%,-100%)">' +
          '<svg viewBox="0 0 24 24" width="28" height="28" fill="#0b6b62" stroke="#fff" stroke-width="1.5">' +
          '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
          '<circle cx="12" cy="9" r="2.5" fill="#fff"/></svg></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
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

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="space-y-2">
      <div
        ref={el}
        className="isolate h-72 w-full overflow-hidden rounded-xl border border-border"
      />
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Navigation className="h-4 w-4" /> {t('getDirections')}
      </a>
    </div>
  );
}
