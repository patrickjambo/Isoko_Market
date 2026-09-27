import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { NewTicketForm } from '@/components/support/new-ticket-form';

export default async function NewSupportTicketPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }
  const t = await getTranslations('support');

  return (
    <div className="container max-w-2xl space-y-5 py-6">
      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToTickets')}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('newTicket')}</h1>
        <p className="text-sm text-muted-foreground">{t('newSubtitle')}</p>
      </div>
      <NewTicketForm />
    </div>
  );
}
