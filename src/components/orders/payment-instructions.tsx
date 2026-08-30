'use client';

import { useState } from 'react';
import { Copy, Check, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Buyer-facing "send the money to this number" screen for the manual P2P flow. */
export function PaymentInstructions({
  payoutNumber,
  method,
  amountLabel,
}: {
  payoutNumber: string;
  method: string;
  amountLabel: string;
}) {
  const t = useTranslations('orders');
  const [copied, setCopied] = useState(false);
  const providerName = method === 'manual_airtel' ? 'Airtel Money' : 'MTN MoMo';

  async function copy() {
    try {
      await navigator.clipboard.writeText(payoutNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the number is shown regardless */
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="h-4 w-4 text-primary" /> {t('payInstructionsTitle')}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('payInstructions', { amount: amountLabel, provider: providerName })}
      </p>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{providerName}</p>
          <p className="truncate font-mono text-lg font-bold tracking-wide">{payoutNumber}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}
