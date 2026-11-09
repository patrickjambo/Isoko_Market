'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight, MessageCircle, Users, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ------------------------------------------------------------------ */
/*  Static testimonial data                                             */
/* ------------------------------------------------------------------ */
const TESTIMONIALS = [
  {
    id: 1,
    name: 'Uwimana Aline',
    avatar: 'UA',
    color: 'bg-emerald-500',
    timeAgo: '2 days ago',
    quote: 'Zenova is amazing! I found a reliable laptop seller in Kigali.',
    rating: 5,
  },
  {
    id: 2,
    name: 'Niyonzima Jean',
    avatar: 'NJ',
    color: 'bg-blue-500',
    timeAgo: '1 week ago',
    quote: 'Easy to post and get quick response.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Mugisha Claudine',
    avatar: 'MC',
    color: 'bg-purple-500',
    timeAgo: '2 weeks ago',
    quote: 'A great platform for buying and selling.',
    rating: 5,
  },
  {
    id: 4,
    name: 'Habimana Eric',
    avatar: 'HE',
    color: 'bg-orange-500',
    timeAgo: '3 weeks ago',
    quote: 'I sold my phone within 24 hours. Incredible!',
    rating: 5,
  },
  {
    id: 5,
    name: 'Kayitesi Grace',
    avatar: 'KG',
    color: 'bg-pink-500',
    timeAgo: '1 month ago',
    quote: 'Best marketplace in Rwanda. Very trustworthy.',
    rating: 5,
  },
  {
    id: 6,
    name: 'Mutabazi David',
    avatar: 'MD',
    color: 'bg-teal-500',
    timeAgo: '1 month ago',
    quote: 'I found a job through Zenova. Life-changing platform!',
    rating: 5,
  },
];

const WHATSAPP_URL = 'https://wa.me/79365299465';
const CARDS_PER_SLIDE_DESKTOP = 3;
const AUTO_ADVANCE_MS = 4000;

/* ------------------------------------------------------------------ */
/*  Star row                                                            */
/* ------------------------------------------------------------------ */
function StarRow({ count = 5, size = 'sm' }: { count?: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className={`${cls} fill-yellow-400 text-yellow-400`} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single testimonial card                                             */
/* ------------------------------------------------------------------ */
function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof TESTIMONIALS)[number];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white/90 p-4 shadow-sm backdrop-blur-sm h-full">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${testimonial.color}`}
        >
          {testimonial.avatar}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight">{testimonial.name}</p>
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">{testimonial.timeAgo}</p>
        </div>
      </div>
      <p className="flex-1 text-sm italic text-foreground/80">"{testimonial.quote}"</p>
      <StarRow count={testimonial.rating} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Carousel                                                            */
/* ------------------------------------------------------------------ */
function TestimonialCarousel() {
  const total = TESTIMONIALS.length;
  // Number of slides: each slide shows up to 3 cards on desktop, 1 on mobile.
  // We track the active card index (0-based).
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSlides = Math.ceil(total / CARDS_PER_SLIDE_DESKTOP);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % totalSlides);
  }, [totalSlides]);

  /* Auto-advance */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  const visibleCards = TESTIMONIALS.slice(
    activeIndex * CARDS_PER_SLIDE_DESKTOP,
    activeIndex * CARDS_PER_SLIDE_DESKTOP + CARDS_PER_SLIDE_DESKTOP,
  );

  return (
    <div
      className="relative flex flex-col gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Cards row */}
      <div className="relative overflow-hidden">
        {/* Desktop: 3 cards side-by-side */}
        <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
          {visibleCards.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} />
          ))}
        </div>
        {/* Mobile: 1 card */}
        <div className="sm:hidden">
          {visibleCards[0] && <TestimonialCard testimonial={visibleCards[0]} />}
        </div>
      </div>

      {/* Nav row */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={prev}
          aria-label="Previous"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-sm transition hover:bg-primary/5 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Next"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-sm transition hover:bg-primary/5 active:scale-95"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main exported section                                               */
/* ------------------------------------------------------------------ */
export function CommunitySection() {
  const t = useTranslations('community');

  return (
    <section className="relative overflow-hidden border-t border-border bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="container relative py-14">
        {/* Three-column grid: Left info | Carousel | Right CTA */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr_220px] lg:gap-8 lg:items-start">

          {/* ── Left: community info ─────────────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-tight">
              {t('title')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('subtitle')}</p>

            {/* Rating */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StarRow count={5} size="md" />
                <span className="text-lg font-bold">4.8/5</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('basedOn')}</p>
            </div>
          </div>

          {/* ── Center: carousel ─────────────────────────────── */}
          <div className="min-w-0">
            <TestimonialCarousel />
          </div>

          {/* ── Right: feedback CTA ──────────────────────────── */}
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-primary/20 bg-white/70 p-6 shadow-sm backdrop-blur-sm lg:sticky lg:top-24">
            <div className="flex items-center gap-2 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('feedbackTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('feedbackSubtitle')}</p>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#1ebe5d] hover:shadow-md active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              {t('feedbackCta')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
