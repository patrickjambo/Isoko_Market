'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export type HeroSlide = { src: string; title: string; label: string; href: string };

/**
 * Full-bleed hero backdrop: REAL marketplace photos fill the hero and loop with
 * a crossfade + slow Ken Burns zoom (video-like motion), so the hero shows the
 * platform in action using our own live content — not a captured screen. Returns
 * two stacked layers (images at z-0, overlays at z-20) so the section's scrim can
 * sit between them at z-10. An optional promo `videoSrc` plays as the first panel.
 */
export function HeroShowcase({ slides, videoSrc }: { slides: HeroSlide[]; videoSrc?: string }) {
  const t = useTranslations('home');
  const panels = videoSrc ? slides.length + 1 : slides.length;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (panels <= 1) return;
    // The video (panel 0) gets a longer beat so it can play; photos rotate slower
    // than the card version since they're the whole backdrop now.
    const isVideo = videoSrc && i === 0;
    const id = setTimeout(() => setI((p) => (p + 1) % panels), isVideo ? 9000 : 4500);
    return () => clearTimeout(id);
  }, [i, panels, videoSrc]);

  if (panels === 0) return null;
  const videoActive = Boolean(videoSrc) && i === 0;
  const active = videoSrc ? slides[i - 1] : slides[i];

  return (
    <>
      {/* Image / video layer */}
      <div className="absolute inset-0 z-0">
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
          const isActive = (videoSrc ? idx + 1 : idx) === i;
          return (
            <div
              key={s.src + idx}
              className={cn(
                'absolute inset-0 transition-opacity duration-[1200ms]',
                isActive ? 'opacity-100' : 'opacity-0'
              )}
            >
              <Image
                src={s.src}
                alt={s.title}
                fill
                sizes="100vw"
                className={cn('object-cover', isActive && 'animate-kenburns')}
                priority={idx === 0}
                unoptimized
              />
            </div>
          );
        })}
      </div>

      {/* Overlay layer (above the scrim) — a "Live" tag, a caption that links to
          the real listing, and progress dots. Container ignores pointer events;
          only the interactive bits re-enable them. */}
      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {t('showcaseTag')}
        </span>

        {active && !videoActive && (
          <Link
            href={active.href}
            className="pointer-events-auto absolute bottom-12 right-5 max-w-[16rem] rounded-lg bg-black/40 px-3 py-2 backdrop-blur transition-colors hover:bg-black/55"
          >
            <span className="inline-block rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
              {active.label}
            </span>
            <p className="mt-1 truncate text-sm font-semibold text-white">{active.title}</p>
          </Link>
        )}

        {panels > 1 && (
          <div className="pointer-events-auto absolute bottom-5 right-5 flex gap-1.5">
            {Array.from({ length: panels }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`${idx + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
