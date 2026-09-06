'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';

// Inline WhatsApp glyph (lucide has no brand icons).
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.48 15l-1.06 3.9 4-1.05A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.06l-.3-.18-2.37.62.63-2.3-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm4.44 10.2c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.57.19 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

/**
 * Share a listing/job. Uses the native share sheet where available (which
 * surfaces WhatsApp on mobile), and always offers a direct WhatsApp link +
 * "copy link" fallback — WhatsApp is how most trading spreads here.
 */
export function ShareButton({ title, label }: { title: string; label: string }) {
  const t = useTranslations('common');
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const url = () => (typeof window !== 'undefined' ? window.location.href : '');
  const message = `${title} — ${t('shareVia')} Isoko`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast(t('linkCopied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('error'), 'error');
    }
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: message, url: url() });
      } catch {
        /* user cancelled — no-op */
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 className="h-4 w-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url()}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> {t('shareWhatsApp')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {t('copyLink')}
        </DropdownMenuItem>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <DropdownMenuItem onClick={nativeShare}>
            <Share2 className="h-4 w-4" /> {t('shareMore')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
