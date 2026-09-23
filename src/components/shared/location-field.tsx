'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, Check, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { LocationButton, type GeoResult } from '@/components/shared/location-button';
import { searchPlaces, getAccuratePosition, reverseGeocode, type PlaceResult } from '@/lib/geolocation';
import { isInRwanda } from '@/lib/rwanda';

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
  autoLocate = false,
}: {
  location: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (v: { location: string; latitude: number | null; longitude: number | null }) => void;
  placeholder?: string;
  /** Attempt to capture the device's precise location on mount (posting flows),
   *  so listings/jobs get exact coordinates for "near me" + an exact map pin. */
  autoLocate?: boolean;
}) {
  const t = useTranslations('common');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLocating, setAutoLocating] = useState(false);
  // GPS accuracy of the last capture (metres). null = set manually (pin/search),
  // which is exact by intent. Drives the confidence line so a non-technical seller
  // knows whether their location is precise or needs a nudge on the map.
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const autoTried = useRef(false);
  const hasPin = latitude != null && longitude != null;

  // Auto-capture the device location once, when asked and none is set yet. The
  // browser permission prompt is the consent; if denied/unavailable the manual
  // search + pin remain, so nothing breaks — we just don't get exact coordinates.
  useEffect(() => {
    if (!autoLocate || autoTried.current || hasPin) return;
    autoTried.current = true;
    setAutoLocating(true);
    (async () => {
      try {
        const fix = await getAccuratePosition();
        // A laptop with no GPS can report a Wi-Fi/IP point in the wrong country —
        // don't auto-fill a coordinate outside Rwanda; let them set it manually.
        if (!isInRwanda(fix.latitude, fix.longitude)) return;
        setAccuracy(fix.accuracy);
        const label = await reverseGeocode(fix.latitude, fix.longitude);
        onChangeRef.current({
          location: label ?? location,
          latitude: fix.latitude,
          longitude: fix.longitude,
        });
      } catch {
        /* denied / unavailable — manual search + pin still work */
      } finally {
        setAutoLocating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        onLocated={(g: GeoResult) => {
          setAccuracy(g.accuracy ?? null);
          onChange({ location: g.label ?? location, latitude: g.latitude, longitude: g.longitude });
        }}
      />

      {autoLocating && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {t('detectingLocation')}
        </p>
      )}

      {/* Confidence line: tells a non-technical seller if the auto GPS is exact,
          or approximate (laptop) and needs a nudge on the map below. */}
      {!autoLocating && hasPin && accuracy != null && accuracy > 150 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-2 text-xs text-accent-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>{t('locApprox', { m: Math.round(accuracy) })}</span>
        </p>
      )}
      {!autoLocating && hasPin && (accuracy == null || accuracy <= 150) && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {accuracy != null ? t('locPrecise', { m: Math.round(accuracy) }) : t('locSet')}
        </p>
      )}

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
                    setAccuracy(null); // picked a place = exact by intent
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
            onChange={(lat, lng, label) => {
              setAccuracy(null); // dragging the pin = the exact spot
              onChange({ location: label ?? location, latitude: lat, longitude: lng });
            }}
          />
        </div>
      )}
    </div>
  );
}
