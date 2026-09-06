'use client';

import { useState } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';

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

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast(t('geoUnsupported'), 'error');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label: string | undefined;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (res.ok) {
            const j = await res.json();
            label =
              [j.locality || j.city, j.principalSubdivision].filter(Boolean).join(', ') || undefined;
          }
        } catch {
          /* label is best-effort — coordinates are what matter */
        }
        onLocated({ latitude, longitude, label });
        setLoading(false);
        toast(t('locationCaptured'), 'success');
      },
      (err) => {
        setLoading(false);
        toast(err.code === err.PERMISSION_DENIED ? t('geoDenied') : t('geoError'), 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
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
