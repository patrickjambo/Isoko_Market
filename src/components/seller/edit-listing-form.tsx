'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ImageUploader } from '@/components/shared/image-uploader';
import { ContactFields } from '@/components/shared/contact-fields';
import { listingConditions } from '@/lib/validators/listing';
import type { ContactChannels } from '@/lib/contact';

type Category = { id: string; name: string };

export type EditListingInitial = {
  title: string;
  price: string; // whole RWF as a string for the input
  categoryId: string;
  condition: string;
  location: string;
  description: string;
  images: string[];
  contact: ContactChannels;
  showPhone: boolean;
  tags: string[];
};

/** Single-page edit form for a seller's own listing (photos, price, name, …). */
export function EditListingForm({
  listingId,
  categories,
  initial,
}: {
  listingId: string;
  categories: Category[];
  initial: EditListingInitial;
}) {
  const t = useTranslations('marketplace.form');
  const tc = useTranslations('common');
  const ts = useTranslations('sell');
  const tcond = useTranslations('marketplace.condition');
  const router = useRouter();
  const { toast } = useToast();

  const [d, setD] = useState<EditListingInitial>(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EditListingInitial>) => setD((prev) => ({ ...prev, ...patch }));

  async function save() {
    if (d.images.length === 0) return toast(ts('photoNudge'), 'error');
    if (d.title.trim().length < 3) return toast(t('titleLabel'), 'error');
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: d.title,
          description: d.description,
          price: Number(d.price || 0),
          categoryId: d.categoryId || null,
          condition: d.condition,
          location: d.location,
          images: d.images,
          tags: d.tags,
          showPhone: d.showPhone,
          contactInfo: d.contact,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      toast(tc('save'), 'success');
      router.push(`/marketplace/${listingId}`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t('photosLabel')}</Label>
        <ImageUploader value={d.images} onChange={(v) => set({ images: v })} max={6} />
        <p className="text-xs text-muted-foreground">{ts('step1Hint')}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t('titleLabel')}</Label>
        <Input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('priceLabel')}</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={d.price}
            onChange={(e) => set({ price: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('conditionLabel')}</Label>
          <Select value={d.condition} onChange={(e) => set({ condition: e.target.value })}>
            {listingConditions.map((c) => (
              <option key={c} value={c}>
                {tcond(c)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('categoryLabel')}</Label>
        <Select value={d.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('locationLabel')}</Label>
        <Input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Kigali, Nyarugenge" />
      </div>

      <div className="space-y-1.5">
        <Label>{t('descriptionLabel')}</Label>
        <Textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={5} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={d.showPhone}
          onChange={(e) => set({ showPhone: e.target.checked })}
          className="h-4 w-4 rounded border-input text-primary"
        />
        {ts('showPhone')}
      </label>

      <ContactFields value={d.contact} onChange={(v) => set({ contact: v })} />

      <Button onClick={save} disabled={saving} size="lg" className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tc('save')}
      </Button>
    </div>
  );
}
