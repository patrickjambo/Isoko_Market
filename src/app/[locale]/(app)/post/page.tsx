import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Store, Wrench, Briefcase, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';

/**
 * The unified "+ Post" chooser (Section 8.2) — one entry point for both the
 * commerce and employment paths.
 */
export default async function PostPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();

  const options = [
    { href: '/dashboard/sell', icon: Store, label: t('nav.postItem'), tone: 'primary' as const },
    {
      href: '/dashboard/sell',
      icon: Wrench,
      label: t('nav.postService'),
      tone: 'primary' as const,
    },
    { href: '/jobs/new', icon: Briefcase, label: t('nav.postJob'), tone: 'accent' as const },
  ];

  return (
    <div className="container max-w-lg py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('post.chooseTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('post.chooseSubtitle')}</p>
      <div className="mt-6 space-y-3">
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <Link
              key={o.href}
              href={o.href}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  o.tone === 'accent'
                    ? 'bg-accent/10 text-accent'
                    : 'bg-secondary text-primary'
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex-1 font-semibold">{o.label}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
