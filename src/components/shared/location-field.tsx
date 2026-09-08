'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { LocationButton, type GeoResult } from '@/components/shared/location-button';
import { PlaceSearch } from '@/components/shared/place-search';

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
 * Set a location three ways, easiest first — so it works for everyone, not just
 * map-savvy users:
 *  1. "Use my location" (one tap; accurate on phones).
 *  2. Type your area and pick it (no map skills needed).
 *  3. The map below just CONFIRMS the spot — drag the pin only if you want to
 *     fine-tune. It's never the required step.
 * Whichever they use, the coordinates are what buyers navigate to.
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
  const t = useTranslations('common');
  const hasPin = latitude != null && longitude != null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <LocationButton done={hasPin} onLocated={(g: GeoResult) => onChange(g)} />
        <span className="text-xs text-muted-foreground">{t('orSearchArea')}</span>
      </div>

      <PlaceSearch
        onPick={(r) => onChange({ latitude: r.latitude, longitude: r.longitude, label: r.label })}
      />

      {hasPin && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{t('confirmOnMap')}</p>
          <MapPicker
            value={{ lat: latitude, lng: longitude }}
            onChange={(lat, lng, label) => onChange({ latitude: lat, longitude: lng, label })}
          />
        </div>
      )}
    </div>
  );
}
