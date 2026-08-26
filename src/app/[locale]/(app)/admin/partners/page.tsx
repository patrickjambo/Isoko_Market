import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PartnersManager } from '@/components/admin/partners-manager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPartnersPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  const partners = await prisma.partner.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('partners')}</h1>
        <p className="text-sm text-muted-foreground">{t('partnersSubtitle')}</p>
      </header>
      <PartnersManager
        initial={partners.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          type: p.type,
          status: p.status,
          contactName: p.contactName,
          phone: p.phone,
          location: p.location,
        }))}
      />
    </div>
  );
}
