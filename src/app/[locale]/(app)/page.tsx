import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ShieldCheck,
  Briefcase,
  Smartphone,
  Languages,
  ArrowRight,
  Store,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/marketplace/listing-card';
import { JobCard } from '@/components/jobs/job-card';
import { BuyerStrips } from '@/components/buyer/buyer-strips';
import { WelcomeNudge } from '@/components/onboarding/welcome-nudge';
import { ResumeDraft } from '@/components/seller/resume-draft';
import { PollRefresh } from '@/components/shared/poll-refresh';
import { CountUp } from '@/components/home/count-up';
import { HeroSearch } from '@/components/home/hero-search';
import { RotatingText } from '@/components/home/rotating-text';
import { ConnectTradeGrow } from '@/components/home/connect-trade-grow';
import { HeroShowcase, type HeroSlide } from '@/components/home/hero-showcase';
import { LiveBadge } from '@/components/home/live-badge';
import {
  getFeaturedListings,
  getLatestJobs,
  getLatestServices,
  getPlatformStats,
} from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { getFeatureFlags } from '@/lib/feature-flags';
import { CommunitySection } from '@/components/landing/community-section';

export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('home');

  // All data fetches run in parallel — no sequential waterfalls.
  // `getLatestJobs` is included upfront (it's cached via unstable_cache so the
  // cost when jobs are disabled is a fast cache miss, not a DB query).
  // `getPlatformSettings` is wrapped with React `cache()` so all these calls
  // that go through `getFeatureFlags()` → `getPlatformSettings()` share a
  // single DB round-trip with the root layout and app-shell layout fetches.
  const [flags, listings, services, stats, user, jobs] = await Promise.all([
    getFeatureFlags(),
    getFeaturedListings(8),
    getLatestServices(4),
    getPlatformStats(),
    getCurrentUser(),
    getLatestJobs(6),
  ]);

  // Filter out jobs if the feature is disabled — the fetch already returned
  // cached data with negligible overhead, so we just ignore the result here.
  const visibleJobs = flags.jobsEnabled ? jobs : [];
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  const pillars = [
    {
      icon: ShieldCheck,
      title: t('pillarVerifiedTitle'),
      body: jobsAny ? t('pillarVerifiedBody') : t('pillarVerifiedBodyNoJobs'),
    },
    ...(flags.jobsEnabled
      ? [{ icon: Briefcase, title: t('pillarJobsTitle'), body: t('pillarJobsBody') }]
      : []),
    { icon: Smartphone, title: t('pillarPayTitle'), body: t('pillarPayBody') },
    { icon: Languages, title: t('pillarLangTitle'), body: t('pillarLangBody') },
  ];

  // Hero showcase — a looping frame of REAL marketplace photos (our own live
  // content), mixing products and services so it shows the platform in action.
  const heroSlides: HeroSlide[] = [...listings, ...services]
    .filter((l) => l.images[0]?.url)
    .slice(0, 6)
    .map((l) => ({
      src: l.images[0]!.url,
      title: l.title,
      label: l.kind === 'SERVICE' ? t('showcaseService') : t('showcaseSale'),
      href: `/marketplace/${l.id}`,
    }));

  return (
    <div>
      {/* Auto-refresh the home feed on a visibility-aware interval aligned with
          the 30s data cache (getPlatformStats/getFeaturedListings…) — new posts
          appear on their own without re-querying the DB every tick. */}
      <PollRefresh intervalMs={30000} />

      {/* One-time welcome nudge toward the chosen onboarding path (Visitor §6) */}
      {user && (
        <WelcomeNudge preferredRole={user.preferredRole} name={user.fullName.split(' ')[0]!} flags={flags} />
      )}

      {/* Resume/discard an unfinished "Add Product" draft (self-hides if none). */}
      {user && <ResumeDraft />}

      {/* Personalized buyer home for signed-in users (Section 2) */}
      {user && <BuyerStrips userId={user.id} location={user.location} locale={params.locale} />}

      {/* Hero — full-bleed looping marketplace photo behind the headline, with a
          brand scrim fading left→right so the copy stays readable over it. Shown
          to GUESTS only: it's the marketing pitch to convert new visitors. Signed-
          in users get their personalized home (BuyerStrips) above instead. */}
      {!user && (
      <section className="relative isolate overflow-hidden text-white">
        {/* Full-bleed backdrop: real photos when we have them, else the brand
            gradient so a brand-new install still looks intentional. */}
        {heroSlides.length > 0 ? (
          <HeroShowcase slides={heroSlides} />
        ) : (
          <div className="brand-gradient absolute inset-0 z-0" />
        )}
        {/* Legibility scrim. Desktop: solid brand on the left → fully clear on the
            right so the photo stays bright and visible. Mobile: a gentle overall
            darken since the copy spans the full width over the photo. */}
        <div className="hero-scrim pointer-events-none absolute inset-0 z-10 hidden md:block" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/45 to-black/30 md:hidden" />

        <div className="container relative z-20 flex items-center py-16 md:min-h-[34rem] md:py-24">
          <div className="max-w-xl space-y-6">
            {stats.newToday > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>
                  <span className="font-bold">
                    <CountUp value={stats.newToday} />
                  </span>{' '}
                  {t('newTodaySuffix')}
                </span>
              </div>
            )}

            <h1 className="min-h-[2.2em] text-3xl font-extrabold leading-tight tracking-tight drop-shadow-sm sm:text-4xl md:text-5xl">
              <RotatingText
                phrases={[
                  t('heroRot1'),
                  t('heroRot2'),
                  jobsAny ? t('heroRot3') : t('heroRot3NoJobs'),
                  t('heroRot4'),
                ]}
              />
            </h1>

            {/* Prominent, working search into the marketplace */}
            <HeroSearch />

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
              {flags.jobsEnabled && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <Link href="/jobs">
                    <Briefcase className="h-5 w-5" /> {t('ctaJobs')}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Connect · Trade · Hire · Grow — the four things you can do here. */}
      <ConnectTradeGrow jobsEnabled={flags.jobsEnabled} hiringEnabled={flags.hiringEnabled} />

      {/* Stats band — social proof for new visitors (guests only). Omits any
          hollow zero and the whole band if the platform is brand new. */}
      {!user &&
        (() => {
        const items = [
          stats.users > 0 && { icon: Users, value: stats.users, label: t('statsReached'), suffix: '+' },
          stats.listings > 0 && { icon: Store, value: stats.listings, label: t('statsListings'), suffix: '+' },
          stats.transactions > 0 && {
            icon: Wallet,
            value: stats.transactions,
            label: t('statsTransactions'),
            suffix: '+',
          },
          flags.jobsEnabled &&
            (stats.filled > 0
              ? { icon: Briefcase, value: stats.filled, label: t('statsHired'), suffix: '+' }
              : stats.jobs > 0 && { icon: Briefcase, value: stats.jobs, label: t('statsJobs'), suffix: '+' }),
        ].filter(Boolean) as { icon: LucideIcon; value: number; label: string; suffix?: string }[];
        if (items.length === 0) return null;
        return (
          <section className="border-b border-border bg-card">
            <div className="container grid grid-cols-2 gap-6 py-10 sm:grid-cols-4">
              {items.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex flex-col items-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                      <CountUp value={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Pillars — "why choose us" (guests only: it's a conversion pitch) */}
      {!user && (
      <section className="container py-14">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Eyebrow>{t('pillarsEyebrow')}</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('pillarsTitle')}</h2>
          <p className="mt-2 text-muted-foreground">
            {jobsAny ? t('pillarsSubtitle') : t('pillarsSubtitleNoJobs')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* Featured listings — live */}
      {listings.length > 0 && (
        <section className="container py-6">
          <SectionHeader title={t('featuredListings')} href="/marketplace" live={t('live')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Services — live */}
      {services.length > 0 && (
        <section className="container py-6">
          <SectionHeader title={t('services')} href="/marketplace?kind=SERVICE" live={t('live')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {services.map((s) => (
              <ListingCard key={s.id} listing={s} />
            ))}
          </div>
        </section>
      )}

      {/* Latest jobs — live */}
      {flags.jobsEnabled && visibleJobs.length > 0 && (
        <section className="container py-10">
          <SectionHeader title={t('latestJobs')} href="/jobs" live={t('live')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleJobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {/* Community testimonials + WhatsApp feedback — visible to all visitors */}
      <CommunitySection />

      {/* How it works + closing CTA — conversion sections for guests only. */}
      {!user && (
      <>
      {/* How it works */}
      <section className="border-t border-border bg-secondary/30">
        <div className="container py-14">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Eyebrow>{t('howItWorksEyebrow')}</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('howItWorksTitle')}</h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[1, 2, 3].map((n) => {
              const title = n === 3 && !jobsAny ? t('step3TitleNoJobs') : t(`step${n}Title`);
              const body = n === 3 && !jobsAny ? t('step3BodyNoJobs') : t(`step${n}Body`);
              return (
                <li key={n} className="relative rounded-xl border border-border bg-card p-6 pt-7">
                  <span className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground shadow-sm">
                    {n}
                  </span>
                  <h3 className="mb-1 mt-2 font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="relative overflow-hidden brand-gradient text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="container relative flex flex-col items-center gap-5 py-16 text-center">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            {jobsAny ? t('ctaBandTitle') : t('ctaBandTitleNoJobs')}
          </h2>
          <p className="max-w-xl text-white/90">
            {jobsAny ? t('ctaBandBody') : t('ctaBandBodyNoJobs')}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link href={user ? '/marketplace' : '/get-started'}>
                {user ? t('ctaBrowse') : t('ctaGetStarted')} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {flags.jobsEnabled && (
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                asChild
              >
                <Link href="/jobs">
                  <Briefcase className="h-5 w-5" /> {t('ctaJobs')}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">{children}</p>
  );
}


function SectionHeader({ title, href, live }: { title: string; href: string; live?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {live && <LiveBadge label={live} />}
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href={href} aria-label={title}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
