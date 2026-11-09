'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, ChevronLeft, ChevronRight, MessageSquarePlus, Users, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LeaveFeedbackModal, type FeedbackItem } from './leave-feedback-modal';

/* ------------------------------------------------------------------ */
/*  Curated baseline testimonials                                      */
/* ------------------------------------------------------------------ */
interface TestimonialData {
  id: string | number;
  name: string;
  avatar: string;
  color: string;
  timeAgo: string;
  quote: string;
  rating: number;
}

const DEFAULT_TESTIMONIALS: TestimonialData[] = [
  {
    id: 'base-1',
    name: 'Uwimana Aline',
    avatar: 'UA',
    color: 'bg-emerald-600',
    timeAgo: '2 days ago',
    quote: 'Zenova is amazing! I found a reliable laptop seller in Kigali.',
    rating: 5,
  },
  {
    id: 'base-2',
    name: 'Niyonzima Jean',
    avatar: 'NJ',
    color: 'bg-blue-600',
    timeAgo: '1 week ago',
    quote: 'Easy to post and get quick response.',
    rating: 5,
  },
  {
    id: 'base-3',
    name: 'Mugisha Claudine',
    avatar: 'MC',
    color: 'bg-purple-600',
    timeAgo: '2 weeks ago',
    quote: 'A great platform for buying and selling.',
    rating: 5,
  },
  {
    id: 'base-4',
    name: 'Habimana Eric',
    avatar: 'HE',
    color: 'bg-amber-600',
    timeAgo: '3 weeks ago',
    quote: 'I sold my phone within 24 hours. Incredible!',
    rating: 5,
  },
  {
    id: 'base-5',
    name: 'Kayitesi Grace',
    avatar: 'KG',
    color: 'bg-pink-600',
    timeAgo: '1 month ago',
    quote: 'Best marketplace in Rwanda. Very trustworthy.',
    rating: 5,
  },
  {
    id: 'base-6',
    name: 'Mutabazi David',
    avatar: 'MD',
    color: 'bg-teal-600',
    timeAgo: '1 month ago',
    quote: 'I found a job through Zenova. Life-changing platform!',
    rating: 5,
  },
];

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-amber-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-rose-600',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(dateStrOrObj: string | Date, fallback: string): string {
  try {
    const d = new Date(dateStrOrObj);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / (60 * 1000));
    if (diffMin < 2) return fallback;
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return fallback;
  }
}

const CARDS_PER_SLIDE_DESKTOP = 3;
const AUTO_ADVANCE_MS = 4500;

/* ------------------------------------------------------------------ */
/*  Star rating row                                                   */
/* ------------------------------------------------------------------ */
function StarRow({ count = 5, size = 'sm' }: { count?: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${cls} ${
            i < count
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-transparent text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single testimonial card component                                 */
/* ------------------------------------------------------------------ */
function TestimonialCard({ testimonial }: { testimonial: TestimonialData }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md h-full">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${testimonial.color}`}
        >
          {testimonial.avatar}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {testimonial.name}
            </p>
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <p className="text-xs text-muted-foreground">{testimonial.timeAgo}</p>
        </div>
      </div>
      <p className="flex-1 text-sm italic text-foreground/80 leading-snug">
        &ldquo;{testimonial.quote}&rdquo;
      </p>
      <StarRow count={testimonial.rating} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CommunitySection Component                                   */
/* ------------------------------------------------------------------ */
interface CommunitySectionProps {
  initialFeedbacks?: FeedbackItem[];
}

export function CommunitySection({ initialFeedbacks = [] }: CommunitySectionProps) {
  const t = useTranslations('community');
  const [modalOpen, setModalOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(initialFeedbacks);

  // Fetch feedbacks client-side if none passed initially
  useEffect(() => {
    if (initialFeedbacks.length === 0) {
      fetch('/api/feedback')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.feedbacks && Array.isArray(data.feedbacks) && data.feedbacks.length > 0) {
            setFeedbacks(data.feedbacks);
          }
        })
        .catch(() => {});
    }
  }, [initialFeedbacks]);

  // Combine user feedbacks from DB + default curated testimonials
  const allTestimonials = useMemo<TestimonialData[]>(() => {
    const userItems: TestimonialData[] = feedbacks.map((f, idx) => ({
      id: f.id,
      name: f.name,
      avatar: getInitials(f.name),
      color: AVATAR_COLORS[idx % AVATAR_COLORS.length]!,
      timeAgo: formatRelativeTime(f.createdAt, t('justNow')),
      quote: f.comment,
      rating: f.rating,
    }));

    return [...userItems, ...DEFAULT_TESTIMONIALS];
  }, [feedbacks, t]);

  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSlides = Math.max(1, Math.ceil(allTestimonials.length / CARDS_PER_SLIDE_DESKTOP));

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % totalSlides);
  }, [totalSlides]);

  /* Auto-advance timer */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  const handleFeedbackSuccess = (newFeedback: FeedbackItem) => {
    setFeedbacks((prev) => [newFeedback, ...prev]);
    setActiveIndex(0); // Jump to first slide so new feedback is immediately visible
  };

  const startIndex = activeIndex * CARDS_PER_SLIDE_DESKTOP;
  const visibleCardsDesktop = allTestimonials.slice(
    startIndex,
    startIndex + CARDS_PER_SLIDE_DESKTOP
  );
  // Mobile single card index
  const mobileCard = allTestimonials[activeIndex % allTestimonials.length] ?? allTestimonials[0]!;

  return (
    <>
      <section className="relative overflow-hidden border-t border-border bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/10">
        {/* Decorative background glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="container relative py-12 sm:py-16">
          {/* 3-column layout matching design: Left info | Center carousel | Right feedback */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_1fr_240px] lg:gap-6 lg:items-center">

            {/* ── Left: community info ─────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight leading-tight text-foreground sm:text-3xl">
                {t('title')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('subtitle')}
              </p>

              {/* Rating and review count */}
              <div className="mt-1 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <StarRow count={5} size="md" />
                  <span className="text-lg font-bold text-foreground">4.8/5</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('basedOn')}</p>
              </div>
            </div>

            {/* ── Center: carousel ─────────────────────────────── */}
            <div
              className="min-w-0 flex flex-col gap-4"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {/* Carousel slides */}
              <div className="relative overflow-hidden min-h-[160px]">
                {/* Desktop view: 3 cards */}
                <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
                  {visibleCardsDesktop.map((item) => (
                    <TestimonialCard key={String(item.id)} testimonial={item} />
                  ))}
                </div>

                {/* Mobile view: 1 card */}
                <div className="sm:hidden">
                  <TestimonialCard testimonial={mobileCard} />
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous testimonials"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:bg-muted active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Dot indicators */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalSlides }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      aria-label={`Slide ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        i === activeIndex ? 'w-6 bg-emerald-600' : 'w-2 bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={next}
                  aria-label="Next testimonials"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:bg-muted active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Right: feedback & comment CTA ─────────────────── */}
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-emerald-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <MessageSquarePlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  {t('feedbackTitle')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed sm:text-sm">
                  {t('feedbackSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 hover:shadow-md active:scale-95 sm:w-auto"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>{t('feedbackCta')}</span>
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Leave Feedback / Review Modal */}
      <LeaveFeedbackModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleFeedbackSuccess}
      />
    </>
  );
}
