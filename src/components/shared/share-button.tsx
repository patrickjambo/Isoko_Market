'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';

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
  const message = `${title} — ${t('shareVia')} Zenova`;

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
