import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { categoryName } from '@/lib/i18n-helpers';
import { prisma } from '@/lib/prisma';
import { asContact } from '@/lib/contact';
import { EditListingForm } from '@/components/seller/edit-listing-form';

export const dynamic = 'force-dynamic';

export default async function EditListingPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('marketplace');
  const [listing, categories] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: params.id },
      include: { images: { orderBy: { position: 'asc' }, select: { url: true } } },
    }),
    getCategories(),
  ]);
  if (!listing) notFound();
  // Owner-only — non-owners get a 404 (same as the API authorizer).
  if (listing.sellerId !== user.id) notFound();

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
      <EditListingForm
        listingId={listing.id}
        categories={categories.map((c) => ({ id: c.id, name: categoryName(c, params.locale) }))}
        initial={{
          title: listing.title,
          price: String(Math.round(listing.price / 100)),
          categoryId: listing.categoryId ?? '',
          kind: listing.kind,
          condition: listing.condition,
          location: listing.location,
          description: listing.description,
          images: listing.images.map((i) => i.url),
          contact: asContact(listing.contactInfo) ?? {},
          showPhone: listing.showPhone,
          tags: listing.tags,
        }}
      />
    </div>
  );
}
