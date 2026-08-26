import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, Plus, ImageOff, Eye, MessageCircle } from 'lucide-react';
import type { ListingStatus } from '@prisma/client';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { SellerListingActions } from '@/components/seller/seller-listing-actions';
import { requireWorkspace } from '@/lib/workspace-guard';
import { prisma } from '@/lib/prisma';
import { formatRWF } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusVariant: Record<string, 'success' | 'secondary' | 'muted' | 'destructive' | 'accent'> = {
  ACTIVE: 'success',
  SOLD: 'secondary',
  PAUSED: 'muted',
  DRAFT: 'accent',
  REMOVED: 'destructive',
};

export default async function MyListingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('seller');
  const tm = await getTranslations('marketplace');

  const user = await requireWorkspace('seller', params.locale);
  const listings = await prisma.listing.findMany({
    where: { sellerId: user.id, status: { not: 'REMOVED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
      _count: { select: { conversations: true, favorites: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t('myListings')}</h1>
        <Button asChild variant="accent" size="sm">
          <Link href="/dashboard/sell">
            <Plus className="h-4 w-4" /> {t('sell')}
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('noListings')}
          action={
            <Button asChild variant="accent">
              <Link href="/dashboard/sell">
                <Plus className="h-4 w-4" /> {t('sell')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {listings.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {l.images[0] ? (
                  <Image src={l.images[0].url} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{l.title}</p>
                  <Badge variant={statusVariant[l.status]}>{t(`status_${l.status}`)}</Badge>
                </div>
                <p className="text-sm font-semibold text-primary">{formatRWF(l.price, params.locale)}</p>
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {l.viewCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {l._count.conversations}
                  </span>
                  {l.isFeatured && <Badge variant="accent">{tm('featured')}</Badge>}
                </p>
              </div>
              <SellerListingActions listingId={l.id} status={l.status} isFeatured={l.isFeatured} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
