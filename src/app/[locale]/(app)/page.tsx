import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ShieldCheck,
  Briefcase,
  Smartphone,
  Languages,
  ArrowRight,
  Store,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/marketplace/listing-card';
import { JobCard } from '@/components/jobs/job-card';
import { BuyerStrips } from '@/components/buyer/buyer-strips';
import { WelcomeNudge } from '@/components/onboarding/welcome-nudge';
import { getFeaturedListings, getLatestJobs, getPlatformStats } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('home');

  const [listings, jobs, stats, user] = await Promise.all([
    getFeaturedListings(8),
    getLatestJobs(6),
    getPlatformStats(),
    getCurrentUser(),
  ]);

  const pillars = [
    { icon: ShieldCheck, title: t('pillarVerifiedTitle'), body: t('pillarVerifiedBody') },
    { icon: Briefcase, title: t('pillarJobsTitle'), body: t('pillarJobsBody') },
    { icon: Smartphone, title: t('pillarPayTitle'), body: t('pillarPayBody') },
    { icon: Languages, title: t('pillarLangTitle'), body: t('pillarLangBody') },
  ];

  return (
    <div>
      {/* One-time welcome nudge toward the chosen onboarding path (Visitor §6) */}
      {user && (
        <WelcomeNudge preferredRole={user.preferredRole} name={user.fullName.split(' ')[0]!} />
      )}

      {/* Personalized buyer home for signed-in users (Section 2) */}
      {user && <BuyerStrips userId={user.id} location={user.location} locale={params.locale} />}

      {/* Hero */}
      <section className="brand-gradient text-white">
        <div className="container grid gap-8 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t('heroTitle')}
            </h1>
            <p className="max-w-xl text-base text-white/90 sm:text-lg">{t('heroSubtitle')}</p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Button size="lg" variant="accent" asChild>
                  <Link href="/marketplace">
                    <Store className="h-5 w-5" /> {t('ctaBrowse')}
                  </Link>
                </Button>
              ) : (
                <Button size="lg" variant="accent" asChild>
                  <Link href="/get-started">
                    {t('ctaGetStarted')} <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              )}
              {/* Browse without signing up — lets skeptics evaluate first (§2). */}
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                asChild
              >
                <Link href="/marketplace">{t('ctaSeeWhat')}</Link>
              </Button>
            </div>
            {/* Social proof — omit any hollow zero rather than showing it (§2). */}
            <dl className="flex gap-8 pt-2">
              {stats.users > 0 && <Stat value={stats.users} label={t('statsReached')} />}
              {stats.transactions > 0 && (
                <Stat value={stats.transactions} label={t('statsTransactions')} />
              )}
              {stats.jobs > 0 && <Stat value={stats.jobs} label={t('statsJobs')} />}
            </dl>
          </div>
          <div className="hidden md:block">
            <TrustPanel title={t('trustTitle')} body={t('trustBody')} />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="container py-12">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{t('pillarsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured listings */}
      {listings.length > 0 && (
        <section className="container py-6">
          <SectionHeader title={t('featuredListings')} href="/marketplace" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Latest jobs */}
      {jobs.length > 0 && (
        <section className="container py-10">
          <SectionHeader title={t('latestJobs')} href="/jobs" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-t border-border bg-secondary/30">
        <div className="container py-12">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">
            {t('howItWorksTitle')}
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="relative rounded-xl bg-card p-6">
                <span className="absolute -top-3 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">
                  {n}
                </span>
                <h3 className="mb-1 mt-2 font-semibold">{t(`step${n}Title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`step${n}Body`)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Button size="lg" asChild>
              <Link href="/register">{t('ctaRegister')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-extrabold">{value.toLocaleString()}</dt>
      <dd className="text-xs text-white/80">{label}</dd>
    </div>
  );
}

function TrustPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="text-sm text-white/85">{body}</p>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <Button variant="ghost" size="sm" asChild>
        <Link href={href} aria-label={title}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
