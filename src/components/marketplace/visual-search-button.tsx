'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Upload, X, Loader2, Search, ImageIcon, RotateCcw } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { ListingCard, type ListingCardData } from '@/components/marketplace/listing-card';
import { cn } from '@/lib/utils';

type VisualSearchResult = {
  items: ListingCardData[];
  total: number;
  alternativesUsed?: boolean;
  queryDescription: string;
  queryTags: string;
  suggestedQuery?: string;
};

type State =
  | { phase: 'idle' }
  | { phase: 'searching'; file: File; previewUrl: string }
  | { phase: 'results'; file: File; previewUrl: string; result: VisualSearchResult }
  | { phase: 'error'; file: File; previewUrl: string; message: string };

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const MAX_UPLOAD_BYTES = 3.8 * 1024 * 1024; // Stay safely under Vercel's 4.5 MB serverless limit

/**
 * Downsize and re-encode a phone camera / gallery image to <= 1024px JPEG before upload.
 * Keeps visual details sharp for AI analysis while shrinking 5-12 MB phone photos to ~120 KB.
 */
async function optimizeSearchImage(file: File): Promise<File> {
  try {
    const maxEdge = 1024;
    let width = 0;
    let height = 0;
    let drawSource: CanvasImageSource | null = null;
    let cleanup: (() => void) | null = null;

    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        drawSource = bitmap;
        cleanup = () => bitmap.close();
      } catch {
        drawSource = null;
      }
    }

    if (!drawSource) {
      const objUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new window.Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objUrl;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
      drawSource = img;
      cleanup = () => URL.revokeObjectURL(objUrl);
    }

    try {
      if (!width || !height) return file;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(drawSource, 0, 0, targetW, targetH);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
      );
      if (!blob) return file;
      return new File([blob], 'search-photo.jpg', { type: 'image/jpeg' });
    } finally {
      cleanup?.();
    }
  } catch {
    return file;
  }
}

/**
 * Extract `{ items, ... }` from `/api/visual-search` responses.
 * Handles direct `jsonOk` payloads AND optional `{ data }` envelopes safely.
 */
function parseSearchPayload(raw: unknown): VisualSearchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const payload =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;

  if (!Array.isArray(payload.items)) return null;

  return {
    items: payload.items as ListingCardData[],
    total: typeof payload.total === 'number' ? payload.total : payload.items.length,
    alternativesUsed: Boolean(payload.alternativesUsed),
    queryDescription: typeof payload.queryDescription === 'string' ? payload.queryDescription : '',
    queryTags: typeof payload.queryTags === 'string' ? payload.queryTags : '',
    suggestedQuery: typeof payload.suggestedQuery === 'string' ? payload.suggestedQuery : undefined,
  };
}

/** Extract a human-readable string from `{ error: { code, message } }` or `{ error: string }`. */
function extractErrorMessage(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== 'object') return fallback;
  const record = raw as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  if (record.error && typeof record.error === 'object') {
    const msg = (record.error as Record<string, unknown>).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  return fallback;
}

/**
 * Visual search button — camera/lens icon beside Zenova's search bar.
 * Lets users snap a photo or upload an image to find visually similar items
 * without typing product names.
 */
export function VisualSearchButton({ hero = false }: { hero?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokePreview();
    };
  }, []);

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    revokePreview();
    setState({ phase: 'idle' });
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) reset();
    setOpen(isOpen);
  }

  async function runSearch(file: File, previewUrl: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ phase: 'searching', file, previewUrl });

    const timeoutId = setTimeout(() => controller.abort('timeout'), 35_000);

    try {
      const optimized = await optimizeSearchImage(file);
      if (optimized.size > MAX_UPLOAD_BYTES) {
        setState({
          phase: 'error',
          file,
          previewUrl,
          message: 'Image is too large even after compression. Try a smaller photo.',
        });
        return;
      }

      const form = new FormData();
      form.append('image', optimized);

      const res = await fetch('/api/visual-search', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setState({
          phase: 'error',
          file,
          previewUrl,
          message:
            res.status === 413
              ? 'Photo file was too large for the server. Please try another photo.'
              : `Search service returned an unexpected response (HTTP ${res.status}).`,
        });
        return;
      }

      const json: unknown = await res.json();

      if (!res.ok) {
        setState({
          phase: 'error',
          file,
          previewUrl,
          message: extractErrorMessage(json, 'Visual search failed. Please try again.'),
        });
        return;
      }

      const parsed = parseSearchPayload(json);
      if (!parsed) {
        setState({
          phase: 'error',
          file,
          previewUrl,
          message: 'Unexpected response from visual search. Please retry.',
        });
        return;
      }

      setState({ phase: 'results', file, previewUrl, result: parsed });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (controller.signal.reason === 'timeout') {
          setState({
            phase: 'error',
            file,
            previewUrl,
            message: 'Search timed out. Check your connection and tap Retry.',
          });
        }
        return;
      }
      setState({
        phase: 'error',
        file,
        previewUrl,
        message: 'Connection error. Please check your internet connection and try again.',
      });
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const looksLikeImage = file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name);
    if (!looksLikeImage) {
      toast('Please select an image file (JPEG, PNG or WebP).', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('Photo is too large (max 20 MB).', 'error');
      return;
    }

    revokePreview();
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    void runSearch(file, previewUrl);
  }

  function handleRefineInMarketplace() {
    if (state.phase !== 'results') return;
    const rawTerm =
      state.result.suggestedQuery ||
      state.result.queryTags.split(',')[0]?.trim() ||
      '';
    const url = rawTerm
      ? `/marketplace?q=${encodeURIComponent(rawTerm)}&visual=1`
      : '/marketplace?visual=1';
    setOpen(false);
    router.push(url);
  }

  const previewUrl = state.phase !== 'idle' ? state.previewUrl : null;
  const isResults = state.phase === 'results';

  return (
    <>
      {/* Hidden file inputs — activated ONLY when user clicks Take Photo or Upload Photo */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileSelect}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileSelect}
      />

      {/* Trigger button beside search bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search by photo"
        title="Search by photo"
        className={
          hero
            ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/95 text-primary shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        }
      >
        <Camera className={hero ? 'h-5 w-5' : 'h-4 w-4'} />
      </button>

      {/* Visual search dialog — compact on phones, wider only when showing result cards */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className={cn(
            'flex max-h-[84dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0',
            isResults
              ? 'w-[calc(100%-1.5rem)] max-w-md sm:max-w-lg'
              : 'w-[calc(100%-2.5rem)] max-w-[320px] sm:max-w-sm',
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3.5 pr-10">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <Camera className="h-4 w-4 text-primary" />
              Search by Photo
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
            {/* Phase: idle */}
            {state.phase === 'idle' && (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Snap or upload a product photo to find similar items on Zenova.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary sm:p-4 sm:text-sm"
                  >
                    <Camera className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                    <span>Take Photo</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary sm:p-4 sm:text-sm"
                  >
                    <Upload className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                    <span>Upload Photo</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Gallery</span>
                  </button>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  JPEG, PNG, WebP · Optimized automatically
                </p>
              </div>
            )}

            {/* Phase: searching */}
            {state.phase === 'searching' && previewUrl && (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-border bg-muted sm:h-36 sm:w-36">
                  <Image
                    src={previewUrl}
                    alt="Analysing product"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Searching similar products…</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Identifying object, color &amp; style
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            )}

            {/* Phase: results */}
            {state.phase === 'results' && previewUrl && (
              <div className="space-y-3">
                {/* Query thumbnail + AI visual summary */}
                <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-2.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image src={previewUrl} alt="Your photo" fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-foreground">What Zenova sees</p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {state.result.queryDescription || 'Visual analysis complete.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Try another photo"
                    title="Try another photo"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {state.result.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 py-5 text-center">
                    <ImageIcon className="h-9 w-9 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No matching products listed yet</p>
                    <p className="text-xs text-muted-foreground">
                      Try another photo or browse the full marketplace.
                    </p>
                    <div className="mt-1 flex gap-2">
                      <Button variant="outline" size="sm" onClick={reset}>
                        Try Another Photo
                      </Button>
                      <Button size="sm" onClick={handleRefineInMarketplace}>
                        <Search className="h-3.5 w-3.5" /> Browse Marketplace
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {state.result.alternativesUsed
                          ? 'No close match — nearest available items'
                          : `${state.result.total} visually similar item${state.result.total !== 1 ? 's' : ''}`}
                      </p>
                      <span className="text-[11px] text-muted-foreground">Ranked by relevance</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {state.result.items.slice(0, 6).map((listing) => (
                        <div key={listing.id} onClick={() => handleClose(false)}>
                          <ListingCard listing={listing} variant="grid" showFavorite={false} />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                        <RotateCcw className="h-3.5 w-3.5" /> New Photo
                      </Button>
                      <Button size="sm" onClick={handleRefineInMarketplace} className="flex-1">
                        <Search className="h-3.5 w-3.5" /> Refine in Marketplace
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Phase: error */}
            {state.phase === 'error' && (
              <div className="space-y-3">
                {previewUrl && (
                  <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-xl border border-border">
                    <Image src={previewUrl} alt="Your photo" fill className="object-cover" unoptimized />
                  </div>
                )}
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center">
                  <p className="text-xs font-semibold text-destructive sm:text-sm">Search failed</p>
                  <p className="mt-1 text-xs text-muted-foreground">{state.message}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                    Try Another
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void runSearch(state.file, state.previewUrl)}
                    className="flex-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
