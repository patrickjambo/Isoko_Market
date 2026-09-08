'use client';

import { useState } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { getAccuratePosition, geoErrorKey } from '@/lib/geolocation';

export type GeoResult = { latitude: number; longitude: number; label?: string };

/**
 * "Use my location" — captures precise GPS from the browser (permission-gated,
 * one tap) and best-effort reverse-geocodes a human label. Coordinates power
 * "near me" search and turn-by-turn directions; the label is a convenience.
 * Reverse geocoding is a free, keyless service and failing it never blocks the
 * capture.
 */
export function LocationButton({
  onLocated,
  done = false,
}: {
  onLocated: (g: GeoResult) => void;
  done?: boolean;
}) {
  const t = useTranslations('common');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function locate() {
    setLoading(true);
    try {
      // Watches the GPS and returns the most accurate fix (see getAccuratePosition).
      const { latitude, longitude, accuracy } = await getAccuratePosition();
      let label: string | undefined;
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (res.ok) {
          const j = await res.json();
          // Most specific place first, then region and country — deduped so we
          // don't get "Kigali, Kigali". Works anywhere in the world.
          label =
            [...new Set(
              [j.locality || j.city, j.principalSubdivision, j.countryName].filter(Boolean)
            )].join(', ') || undefined;
        }
      } catch {
        /* label is best-effort — coordinates are what matter */
      }
      onLocated({ latitude, longitude, label });
      // A very coarse fix (hundreds of metres+) is usually "wrong": tell the user.
      toast(accuracy > 500 ? t('locationApprox') : t('locationCaptured'), accuracy > 500 ? 'info' : 'success');
    } catch (err) {
      toast(t(geoErrorKey(err)), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={locate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      {t('useMyLocation')}
    </button>
  );
}
