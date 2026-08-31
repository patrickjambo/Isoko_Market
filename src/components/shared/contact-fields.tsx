'use client';

import { Phone, MessageCircle, Mail, Instagram } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContactChannels } from '@/lib/contact';

/**
 * Structured contact inputs shared by the sell-item wizard and the post-a-job
 * form (Rule 3 — one component). Each channel is optional; the poster fills only
 * what they use, and they render as tap-to-contact links on the detail page.
 */
export function ContactFields({
  value,
  onChange,
}: {
  value: ContactChannels;
  onChange: (next: ContactChannels) => void;
}) {
  const t = useTranslations('contact');
  const set = (key: keyof ContactChannels, v: string) => onChange({ ...value, [key]: v });

  const rows = [
    { key: 'phone' as const, Icon: Phone, ph: t('phonePlaceholder'), max: 30 },
    { key: 'whatsapp' as const, Icon: MessageCircle, ph: t('whatsappPlaceholder'), max: 30 },
    { key: 'email' as const, Icon: Mail, ph: t('emailPlaceholder'), max: 160 },
    { key: 'instagram' as const, Icon: Instagram, ph: t('instagramPlaceholder'), max: 60 },
  ];

  return (
    <div className="space-y-2">
      <Label>{t('sectionLabel')}</Label>
      <p className="text-xs text-muted-foreground">{t('sectionHint')}</p>
      <div className="space-y-2">
        {rows.map(({ key, Icon, ph, max }) => (
          <div key={key} className="relative">
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
              placeholder={ph}
              className="pl-9"
              maxLength={max}
              inputMode={key === 'phone' || key === 'whatsapp' ? 'tel' : key === 'email' ? 'email' : 'text'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
