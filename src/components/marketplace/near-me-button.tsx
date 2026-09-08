'use client';

import { useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { getAccuratePosition, geoErrorKey } from '@/lib/geolocation';

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

  async function toggle() {
    if (active) return go({}); // turn off
    setLoading(true);
    try {
      // Same robust GPS reading as "Use my location" — accurate across devices.
      const { latitude, longitude } = await getAccuratePosition();
      go({ lat: String(latitude), lng: String(longitude) });
    } catch (err) {
      toast(tc(geoErrorKey(err)), 'error');
    } finally {
      setLoading(false);
    }
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
