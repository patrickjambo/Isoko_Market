import { getTranslations } from 'next-intl/server';
import { Store } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { initials } from '@/lib/utils';

export type StoreResult = { id: string; name: string; avatarUrl: string | null; isVerified: boolean };

/**
 * When a marketplace search matches a shop/company name, surface those stores as
 * chips above the product results — a one-tap way to open the full storefront
 * instead of scrolling its individual items.
 */
export async function StoreResults({ stores }: { stores: StoreResult[] }) {
  if (stores.length === 0) return null;
  const t = await getTranslations('marketplace');

  return (
    <div className="mb-4 space-y-2">
      <p className="text-sm font-semibold text-muted-foreground">{t('storesMatching')}</p>
      <div className="flex flex-wrap gap-2">
        {stores.map((s) => (
          <Link
            key={s.id}
            href={`/profile/${s.id}`}
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm font-medium shadow-sm transition-colors hover:border-primary hover:bg-secondary"
          >
            <Avatar className="h-6 w-6">
              {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={s.name} />}
              <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
            </Avatar>
            <Store className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="max-w-[12rem] truncate">{s.name}</span>
            {s.isVerified && <VerifiedBadge status="VERIFIED" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
