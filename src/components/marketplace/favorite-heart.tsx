'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSession } from '@/components/providers';
import { cn } from '@/lib/utils';

/** Compact heart overlay for listing cards — server-synced, optimistic. */
export function FavoriteHeart({
  listingId,
  initialFavorited,
}: {
  listingId: string;
  initialFavorited: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSession();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // don't follow the card link
    e.stopPropagation();
    // Preserve context through sign-up (§5) so they return to this exact page.
    if (!user) return router.push(`/register?returnTo=${encodeURIComponent(pathname)}`);
    const next = !favorited;
    setFavorited(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/favorite`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setFavorited(data.favorited);
      else setFavorited(!next);
    } catch {
      setFavorited(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      aria-label="Save"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform active:scale-90"
    >
      <Heart className={cn('h-4 w-4 text-white', favorited && 'fill-destructive text-destructive')} />
    </button>
  );
}
