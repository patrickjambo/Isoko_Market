import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Heart } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/marketplace/listing-card';
import { EmptyState } from '@/components/shared/empty-state';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SavedPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('saved');
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id, listing: { status: { in: ['ACTIVE', 'SOLD'] } } },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          price: true,
          location: true,
          status: true,
          isFeatured: true,
          images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
          seller: { select: { fullName: true, isVerified: true, verificationStatus: true } },
        },
      },
    },
  });

  return (
    <div className="container max-w-4xl py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('title')}</h1>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/marketplace">{t('browse')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {favorites.map((f) => (
            <ListingCard key={f.id} listing={{ ...f.listing, favorited: true }} showFavorite />
          ))}
        </div>
      )}
    </div>
  );
}
