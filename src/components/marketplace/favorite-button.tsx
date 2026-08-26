'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/providers';
import { cn } from '@/lib/utils';

/** Save/favourite a listing — the seller is notified live when it happens. */
export function FavoriteButton({
  listingId,
  initialFavorited,
  initialCount,
}: {
  listingId: string;
  initialFavorited: boolean;
  initialCount: number;
}) {
  const t = useTranslations('marketplace');
  const router = useRouter();
  const pathname = usePathname();
  const user = useSession();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) return router.push(`/register?returnTo=${encodeURIComponent(pathname)}`);
    setBusy(true);
    // Optimistic update.
    const next = !favorited;
    setFavorited(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/listings/${listingId}/favorite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setFavorited(data.favorited);
      setCount(data.count);
    } catch {
      // revert on failure
      setFavorited(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={busy} aria-pressed={favorited}>
      <Heart className={cn('h-4 w-4', favorited && 'fill-destructive text-destructive')} />
      {favorited ? t('saved') : t('save')}
      {count > 0 && <span className="text-muted-foreground">· {count}</span>}
    </Button>
  );
}
