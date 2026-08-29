'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X, GripVertical, Link as LinkIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Multi-image uploader with client-side compression before upload (Section 9.2 —
 * "compressed on upload"). Downsizes to max 1280px and re-encodes to WebP in the
 * browser, so large phone photos don't burn the user's data bundle.
 */
async function compressImage(file: File, maxSize = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/webp', quality)
  );
}

export function ImageUploader({
  value,
  onChange,
  max = 6,
  privateUpload = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  privateUpload?: boolean;
}) {
  const t = useTranslations('marketplace.form');
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [linking, setLinking] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = max - value.length;
    const toUpload = Array.from(files).slice(0, room);
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const blob = await compressImage(file);
        const form = new FormData();
        form.append('file', new File([blob], 'photo.webp', { type: 'image/webp' }));
        if (privateUpload) form.append('private', 'true');
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message ?? 'upload failed');
        uploaded.push(data.url);
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // Add a photo by URL: the server fetches + stores it (SSRF-guarded), returning
  // a local URL — identical to an upload, so it renders through next/image.
  async function addByUrl() {
    const link = url.trim();
    if (!link || value.length >= max) return;
    setLinking(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, private: privateUpload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Could not add that image URL');
      onChange([...value, data.url]);
      setUrl('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add that image URL', 'error');
    } finally {
      setLinking(false);
    }
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image src={url} alt="" fill sizes="120px" className="object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                <GripVertical className="inline h-3 w-3" /> 1
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary',
              busy && 'opacity-60'
            )}
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span className="text-xs">
              {value.length}/{max}
            </span>
          </button>
        )}
      </div>
      {value.length < max && (
        <div className="flex gap-2">
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addByUrl();
              }
            }}
            placeholder={t('urlPlaceholder')}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={() => void addByUrl()} disabled={linking || !url.trim()}>
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
            {t('addUrl')}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('photosHint')}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
