'use client';

import dynamic from 'next/dynamic';
import { LocationButton, type GeoResult } from '@/components/shared/location-button';

// Map is client-only + lazy (Leaflet touches window and is ~heavy) — it loads
// only when a location section is on screen.
const MapPicker = dynamic(
  () => import('@/components/shared/map-picker').then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-lg border border-border bg-secondary/40" />,
  }
);

/**
 * Full location control: "Use my location" for a quick fix, PLUS a draggable map
 * pin to correct it to the exact spot. The pin is the source of truth for
 * coordinates, so navigation is always right — even on laptops with no GPS.
 */
export function LocationField({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (v: { latitude: number; longitude: number; label?: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <LocationButton
        done={latitude != null}
        onLocated={(g: GeoResult) => onChange(g)}
      />
      <MapPicker
        value={latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null}
        onChange={(lat, lng, label) => onChange({ latitude: lat, longitude: lng, label })}
      />
    </div>
  );
}
