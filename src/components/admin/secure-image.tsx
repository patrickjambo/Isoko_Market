'use client';

import { useState } from 'react';
import { Eye, X, ExternalLink, ImageOff } from 'lucide-react';

/**
 * A private image streamed from an admin-only proxy `src` (ID doc, payment proof,
 * …). Thumbnail opens a full-screen lightbox; the raw storage URL is never
 * exposed and a missing file degrades to a placeholder.
 */
export function SecureImage({
  src,
  alt,
  unavailableLabel,
}: {
  src: string;
  alt: string;
  unavailableLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-24 w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground">
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px]">{unavailableLabel}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
        title={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={() => setFailed(true)}
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
          <Eye className="h-5 w-5" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute right-4 top-4 flex gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
