'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { LocationButton, type GeoResult } from '@/components/shared/location-button';
import { searchPlaces, type PlaceResult } from '@/lib/geolocation';

// Map is client-only + lazy (Leaflet touches window, ~heavy) — loads only when a
// location has been chosen.
const MapPicker = dynamic(
  () => import('@/components/shared/map-picker').then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-lg border border-border bg-secondary/40" />,
  }
);

/**
 * ONE location control that everything syncs to — so the shown name always
 * matches the pin. Set it any way, easiest first:
 *  1. "Use my location" (one tap; accurate on phones).
 *  2. Type your area and pick it (no map skills needed).
 *  3. Drag the map pin to fine-tune — the name updates to the new spot live.
 * The single text box below reflects whichever you use, in real time.
 */
export function LocationField({
  location,
  latitude,
  longitude,
  onChange,
  placeholder,
}: {
  location: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (v: { location: string; latitude: number | null; longitude: number | null }) => void;
  placeholder?: string;
}) {
  const t = useTranslations('common');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPin = latitude != null && longitude != null;

  function onType(v: string) {
    // Keep coordinates until they actually pick a new place (or move the pin).
    onChange({ location: v, latitude, longitude });
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await searchPlaces(v);
      setResults(r);
      setOpen(true);
      setLoading(false);
    }, 350);
  }

  return (
    <div className="space-y-2">
      <LocationButton
        done={hasPin}
        onLocated={(g: GeoResult) =>
          onChange({ location: g.label ?? location, latitude: g.latitude, longitude: g.longitude })
        }
      />

      {/* Single location box: type to search + pick; also reflects GPS and pin drags. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={location}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? t('searchPlacePlaceholder')}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
            {results.map((r, i) => (
              <li key={`${r.latitude},${r.longitude},${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange({ location: r.label, latitude: r.latitude, longitude: r.longitude });
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasPin && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{t('confirmOnMap')}</p>
          <MapPicker
            value={{ lat: latitude, lng: longitude }}
            onChange={(lat, lng, label) =>
              onChange({ location: label ?? location, latitude: lat, longitude: lng })
            }
          />
        </div>
      )}
    </div>
  );
}
