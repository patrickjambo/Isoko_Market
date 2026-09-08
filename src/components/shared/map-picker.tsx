'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker } from 'leaflet';

const KIGALI = { lat: -1.9536, lng: 30.0606 };

/**
 * Drag-a-pin location picker (free OpenStreetMap tiles, no API key). The
 * definitive fix for wrong auto-locations — especially laptops, which have no
 * GPS and guess from Wi-Fi/IP. The seller drops the pin on their exact spot, so
 * buyers navigating there (Get directions) reach the right place on any device.
 *
 * Leaflet is imported dynamically (it touches `window`), so this stays SSR-safe.
 */
export function MapPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const t = useTranslations('common');
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialise once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;

      const start = value ?? KIGALI;
      const m = L.map(el.current, { attributionControl: true }).setView(
        [start.lat, start.lng],
        value ? 16 : 12
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m);

      // A CSS pin (divIcon) — avoids Leaflet's broken default marker image paths.
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
      const mk = L.marker([start.lat, start.lng], { draggable: true, icon: pin }).addTo(m);

      mk.on('dragend', () => {
        const p = mk.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
      m.on('click', (e) => {
        mk.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });

      map.current = m;
      marker.current = mk;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the pin when the coordinates change from outside (e.g. "Use my location").
  useEffect(() => {
    if (map.current && marker.current && value) {
      marker.current.setLatLng([value.lat, value.lng]);
      map.current.setView([value.lat, value.lng], 16);
    }
    // Depend on the coordinates, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  return (
    <div className="space-y-1">
      <div ref={el} className="h-64 w-full overflow-hidden rounded-lg border border-border" />
      <p className="text-xs text-muted-foreground">{t('mapPickerHint')}</p>
    </div>
  );
}
