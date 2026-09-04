import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PackageSearch, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/marketplace/listing-card';
import { MarketplaceFilters } from '@/components/marketplace/marketplace-filters';
import { SaveSearchButton } from '@/components/marketplace/save-search-button';
import { CategoryChips } from '@/components/marketplace/category-chips';
import { KindTabs } from '@/components/marketplace/kind-tabs';
import { ViewToggle } from '@/components/marketplace/view-toggle';
import { MapView } from '@/components/marketplace/map-view';
import { SearchBar } from '@/components/nav/search-bar';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { listingFilterSchema } from '@/lib/validators/listing';
import { searchListings, getCategories, favoritedSet, getDistrictCounts } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { categoryName } from '@/lib/i18n-helpers';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | undefined>;
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('marketplace');

  const filter = listingFilterSchema.parse(searchParams);
  const view = searchParams.view === 'list' ? 'list' : searchParams.view === 'map' ? 'map' : 'grid';
  const districtCounts = view === 'map' ? await getDistrictCounts() : {};
  const [{ items: rawItems, total, page, pageSize }, categories, user] = await Promise.all([
    searchListings(filter),
    getCategories(),
    getCurrentUser(),
  ]);
  // Annotate each card with the buyer's saved state (server-synced hearts).
  const favSet = user ? await favoritedSet(user.id, rawItems.map((i) => i.id)) : new Set<string>();
  const items = rawItems.map((i) => ({ ...i, favorited: favSet.has(i.id) }));
  const showFavorite = Boolean(user);
  const localizedCategories = categories.map((c) => ({
    id: c.id,
    name: categoryName(c, params.locale),
  }));

  return (
    <div className="container py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link href="/marketplace/new">
            <Plus className="h-4 w-4" /> {t('createTitle')}
          </Link>
        </Button>
      </div>

      {/* Search is reachable directly on the feed (Section 8.2) */}
      <div className="mb-4">
        <SearchBar />
      </div>

      {/* Primary browse split: everything · products · services */}
      <div className="mb-4">
        <KindTabs current={searchParams.kind} params={searchParams} />
      </div>

      {/* Category chips (Section 8.3) */}
      <div className="mb-4">
        <CategoryChips
          categories={localizedCategories}
          current={searchParams.categoryId}
          params={searchParams}
        />
      </div>

      <div className="mb-5 flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {total} {t('title').toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          <SaveSearchButton
            current={{
              q: searchParams.q,
              categoryId: searchParams.categoryId,
              kind: searchParams.kind,
              condition: searchParams.condition,
              location: searchParams.location,
              minPrice: searchParams.minPrice,
              maxPrice: searchParams.maxPrice,
            }}
          />
          <ViewToggle view={view} params={searchParams} />
          <MarketplaceFilters categories={localizedCategories} current={searchParams} />
        </div>
      </div>

      {view === 'map' && (
        <div className="mb-6">
          <MapView counts={districtCounts} params={searchParams} />
        </div>
      )}

      {view === 'map' && !searchParams.location ? null : items.length === 0 ? (
        // No dead-end (Section 3): point back to categories/all instead of blank.
        <EmptyState
          icon={PackageSearch}
          title={t('empty')}
          description={t('emptySuggest')}
          action={
            <Button asChild variant="outline">
              <Link href="/marketplace">{t('browseAll')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          {view === 'list' ? (
            <div className="flex flex-col gap-3">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} variant="list" showFavorite={showFavorite} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} showFavorite={showFavorite} />
              ))}
            </div>
          )}
          <Pagination page={page} total={total} pageSize={pageSize} baseParams={searchParams} />
        </>
      )}
    </div>
  );
}
