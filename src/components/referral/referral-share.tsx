'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

/** Shows the user's referral code + invite link with copy / native share. */
export function ReferralShare({ code, link }: { code: string; link: string }) {
  const t = useTranslations('referrals');
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast(t('copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Isoko Market', text: t('subtitle'), url: link });
      } catch {
        /* cancelled */
      }
    } else {
      void copy();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium text-muted-foreground">{t('yourCode')}</p>
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-secondary/40 p-4 text-center">
          <span className="font-mono text-2xl font-extrabold tracking-[0.3em] text-primary">
            {code}
          </span>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-muted-foreground">{t('shareLink')}</p>
        <div className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t('copy')}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <Button onClick={share} className="w-full" size="lg">
        <Share2 className="h-4 w-4" /> {t('share')}
      </Button>
    </div>
  );
}
