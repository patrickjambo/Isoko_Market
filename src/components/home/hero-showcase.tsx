'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export type HeroSlide = { src: string; title: string; label: string; href: string };

/**
 * A compact, branded media frame for the hero's right column. It loops through
 * REAL marketplace photos (crossfade + a slow Ken Burns zoom for a video-like
 * feel), so it authentically showcases what the platform offers — it's our own
 * live content, not a captured screen. An optional promo `videoSrc` plays as the
 * first panel when provided (drop an MP4 in /public and pass its path).
 */
export function HeroShowcase({ slides, videoSrc }: { slides: HeroSlide[]; videoSrc?: string }) {
  const t = useTranslations('home');
  const panels = videoSrc ? slides.length + 1 : slides.length;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (panels <= 1) return;
    // The video (panel 0) gets a longer beat so it can play; photos rotate faster.
    const isVideo = videoSrc && i === 0;
    const id = setTimeout(() => setI((p) => (p + 1) % panels), isVideo ? 8000 : 3400);
    return () => clearTimeout(id);
  }, [i, panels, videoSrc]);

  if (panels === 0) return null;
  const videoActive = Boolean(videoSrc) && i === 0;
  const active = videoSrc ? slides[i - 1] : slides[i];

  return (
    <div className="relative">
      {/* soft halo behind the frame for depth */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-white/5 blur-2xl" />

      {/* Branded "device" frame — the bezel + brand chip make it read as ours. */}
      <div className="relative rounded-2xl border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/30">
          {videoSrc && (
            <video
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
                videoActive ? 'opacity-100' : 'opacity-0'
              )}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
            />
          )}
          {slides.map((s, idx) => {
            const panelIndex = videoSrc ? idx + 1 : idx;
            const isActive = panelIndex === i;
            return (
              <div
                key={s.src + idx}
                className={cn(
                  'absolute inset-0 transition-opacity duration-1000',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              >
                <Image
                  src={s.src}
                  alt={s.title}
                  fill
                  sizes="(min-width: 768px) 40vw, 90vw"
                  className={cn('object-cover', isActive && 'animate-kenburns')}
                  priority={idx === 0}
                  unoptimized
                />
              </div>
            );
          })}

          {/* Legibility scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/25" />

          {/* "Live" brand tag */}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {t('showcaseTag')}
          </div>

          {/* Caption — links to the real listing, so the showcase is also useful */}
          {active && !videoActive && (
            <Link
              href={active.href}
              className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="inline-block rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                  {active.label}
                </span>
                <p className="mt-1 truncate text-sm font-semibold text-white drop-shadow">
                  {active.title}
                </p>
              </div>
              <BadgeCheck className="h-5 w-5 shrink-0 text-white/90" />
            </Link>
          )}
        </div>
      </div>

      {/* Progress dots */}
      {panels > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: panels }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`${idx + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
