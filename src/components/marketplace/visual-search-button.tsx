'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Upload, X, Loader2, Search, ImageIcon, RotateCcw } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
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

type VisualSearchResult = {
  items: ListingCardData[];
  total: number;
  queryDescription: string;
  queryTags: string;
  imageUrl: string;
};

type State =
  | { phase: 'idle' }
  | { phase: 'preview'; file: File; previewUrl: string }
  | { phase: 'searching'; file: File; previewUrl: string }
  | { phase: 'results'; file: File; previewUrl: string; result: VisualSearchResult }
  | { phase: 'error'; file: File; previewUrl: string; message: string };

/**
 * Visual search button — adds a camera/lens icon beside Zenova's search bar.
 * Lets users photograph or upload a product image to find similar listings
 * using Gemini vision, without typing the product name.
 *
 * `hero` prop renders a taller button styled for the hero search section.
 */
export function VisualSearchButton({ hero = false }: { hero?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function reset() {
    setState({ phase: 'idle' });
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      reset();
    }
    setOpen(isOpen);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Image is too large. Maximum 8 MB.', 'error');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setState({ phase: 'preview', file, previewUrl });
  }

  async function handleSearch() {
    if (state.phase !== 'preview' && state.phase !== 'error') return;
    const { file, previewUrl } = state;

    setState({ phase: 'searching', file, previewUrl });

    try {
      const form = new FormData();
      form.append('image', file);

      const res = await fetch('/api/visual-search', { method: 'POST', body: form });
      const json = (await res.json()) as { data?: VisualSearchResult; error?: string };

      if (!res.ok) {
        setState({
          phase: 'error',
          file,
          previewUrl,
          message: json.error ?? 'Visual search failed. Please try again.',
        });
        return;
      }

      const result = json.data as VisualSearchResult;
      setState({ phase: 'results', file, previewUrl, result });
    } catch {
      setState({
        phase: 'error',
        file,
        previewUrl,
        message: 'Connection error. Please check your connection and try again.',
      });
    }
  }

  function handleViewAll() {
    if (state.phase !== 'results') return;
    // Navigate to marketplace with visual=1 signal — existing filters still work
    const tags = state.result.queryTags.split(',')[0]?.trim() ?? '';
    const url = tags
      ? `/marketplace?q=${encodeURIComponent(tags)}&visual=1`
      : '/marketplace?visual=1';
    setOpen(false);
    router.push(url);
  }

  const previewUrl = state.phase !== 'idle' ? (state as { previewUrl: string }).previewUrl : null;
  const result = state.phase === 'results' ? state.result : null;
  const errorMsg = state.phase === 'error' ? state.message : null;

  return (
    <>
      {/* Hidden file inputs — camera capture and gallery */}
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

      {/* Trigger button — compact camera icon beside search */}
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

      {/* Visual search dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Camera className="h-4 w-4 text-primary" />
              Search by Photo
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[80vh] p-5 space-y-4">
            {/* Phase: idle — show options to take or upload photo */}
            {state.phase === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Take or upload a photo of a product to find similar items on Zenova.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  >
                    <Camera className="h-7 w-7 text-primary" />
                    Take Photo
                    <span className="text-xs font-normal text-muted-foreground">Use your camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  >
                    <Upload className="h-7 w-7 text-primary" />
                    Upload Photo
                    <span className="text-xs font-normal text-muted-foreground">From your gallery</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Supports JPEG, PNG and WebP · Max 8 MB
                </p>
              </div>
            )}

            {/* Phase: preview — show selected image + search button */}
            {(state.phase === 'preview' || state.phase === 'searching') && previewUrl && (
              <div className="space-y-4">
                <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-border bg-muted">
                  <Image
                    src={previewUrl}
                    alt="Selected product photo"
                    width={320}
                    height={320}
                    className="h-56 w-full object-contain"
                    unoptimized
                  />
                  {state.phase === 'preview' && (
                    <button
                      type="button"
                      onClick={reset}
                      className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {state.phase === 'searching' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analysing image…</p>
                    </div>
                  )}
                </div>

                {state.phase === 'preview' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reset}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Change
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSearch}
                      className="flex-1"
                    >
                      <Search className="h-4 w-4" />
                      Search for Similar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Phase: results */}
            {state.phase === 'results' && previewUrl && result && (
              <div className="space-y-4">
                {/* Query image thumbnail + description */}
                <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image src={previewUrl} alt="Your photo" fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">What Zenova sees:</p>
                    <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
                      {result.queryDescription || 'Product analysis complete.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Try another photo"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {result.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No similar products found</p>
                    <p className="text-xs text-muted-foreground">
                      Try a clearer photo or one that shows the whole product.
                    </p>
                    <Button variant="outline" size="sm" onClick={reset}>
                      Try Another Photo
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">
                      {result.total} similar product{result.total !== 1 ? 's' : ''} found
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {result.items.slice(0, 6).map((listing) => (
                        <div key={listing.id} onClick={() => setOpen(false)}>
                          <ListingCard listing={listing} variant="grid" />
                        </div>
                      ))}
                    </div>
                    {result.total > 6 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleViewAll}
                      >
                        View All {result.total} Results
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Phase: error */}
            {state.phase === 'error' && (
              <div className="space-y-4">
                {previewUrl && (
                  <div className="relative mx-auto w-24 h-24 overflow-hidden rounded-xl border border-border">
                    <Image src={previewUrl} alt="Your photo" fill className="object-cover" unoptimized />
                  </div>
                )}
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                  <p className="text-sm font-medium text-destructive">Search failed</p>
                  <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                    Try Another Photo
                  </Button>
                  <Button size="sm" onClick={handleSearch} className="flex-1">
                    Retry
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
