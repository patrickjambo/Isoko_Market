'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { formatRWF } from '@/lib/utils';

export type MapMarker = { id: string; title: string; price: number; lat: number; lng: number };

const KIGALI = { lat: -1.9536, lng: 30.0606 };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Live marketplace map (free OpenStreetMap tiles, no API key). Plots each listing
 * that has coordinates at its real spot; tapping a pin opens a popup that links to
 * the listing. Leaflet is imported dynamically (it touches `window`) so this stays
 * SSR-safe — mirrors the location-picker pattern.
 */
export function MarketMap({ markers, locale }: { markers: MapMarker[]; locale: string }) {
  const t = useTranslations('marketplace');
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { attributionControl: true, scrollWheelZoom: false }).setView(
        [KIGALI.lat, KIGALI.lng],
        12
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);
      map.current = m;
      // Container may have been laid out after init — recalc so tiles fill it.
      setTimeout(() => m.invalidateSize(), 0);
      void drawMarkers(m);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-plot when the result set changes (new search/filter/page).
  useEffect(() => {
    if (map.current) void drawMarkers(map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  async function drawMarkers(m: LeafletMap) {
    const L = (await import('leaflet')).default;
    layer.current?.remove();
    if (markers.length === 0) return;

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

    const group = L.layerGroup().addTo(m);
    const points: [number, number][] = [];
    for (const mk of markers) {
      const href = `/${locale}/marketplace/${mk.id}`;
      L.marker([mk.lat, mk.lng], { icon: pin })
        .bindPopup(
          `<a href="${href}" style="font-weight:600;color:#0b6b62;text-decoration:none">${escapeHtml(mk.title)}</a>` +
            `<br/><span style="font-size:12px;color:#555">${formatRWF(mk.price, locale)}</span>`
        )
        .addTo(group);
      points.push([mk.lat, mk.lng]);
    }
    layer.current = group;
    m.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }

  return (
    <div>
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-xl border border-border" />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {markers.length === 0 ? t('mapNoPins') : t('mapPinHint')}
      </p>
    </div>
  );
}
