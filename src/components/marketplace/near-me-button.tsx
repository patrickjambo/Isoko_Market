'use client';

import { useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * "Near me" — one tap grabs the buyer's GPS and filters the feed to listings
 * within range (see searchListings bounding box). Tapping again clears it. The
 * coordinates live only in the URL, never stored.
 */
export function NearMeButton({ params }: { params: Record<string, string | undefined> }) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const active = Boolean(params.lat && params.lng);

  function go(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== 'page' && k !== 'lat' && k !== 'lng') sp.set(k, v);
    }
    for (const [k, v] of Object.entries(extra)) sp.set(k, v);
    const qs = sp.toString();
    router.push(`/marketplace${qs ? `?${qs}` : ''}`);
  }

  function toggle() {
    if (active) return go({}); // turn off
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast(tc('geoUnsupported'), 'error');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        go({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
      },
      (err) => {
        setLoading(false);
        toast(err.code === err.PERMISSION_DENIED ? tc('geoDenied') : tc('geoError'), 'error');
      },
      // Fresh, accurate reading — no stale/cached (often coarse) position.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={toggle} disabled={loading} className="shrink-0">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <X className="h-4 w-4" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      {t('nearMe')}
    </Button>
  );
}
