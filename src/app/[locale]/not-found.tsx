import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
        <SearchX className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">{t('notFound')}</h1>
      <Button asChild className="mt-6">
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  );
}
