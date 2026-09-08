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
import { SpecsEditor } from '@/components/seller/specs-editor';
import { LocationField } from '@/components/shared/location-field';
import { listingConditions, type ListingSpec } from '@/lib/validators/listing';
import { specSuggestionsFor } from '@/lib/specs';
import type { ContactChannels } from '@/lib/contact';

type Category = { id: string; name: string; slug?: string };

export type EditListingInitial = {
  title: string;
  price: string; // whole RWF as a string for the input
  categoryId: string;
  kind: string; // 'PRODUCT' | 'SERVICE' — hides Condition for services
  condition: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  images: string[];
  contact: ContactChannels;
  showPhone: boolean;
  tags: string[];
  specs: ListingSpec[];
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
  const isService = d.kind === 'SERVICE';
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
          latitude: d.latitude,
          longitude: d.longitude,
          images: d.images,
          tags: d.tags,
          specs: isService ? [] : d.specs.filter((s) => s.label.trim() && s.value.trim()),
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

      <div className={`grid gap-3 ${isService ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div className="space-y-1.5">
          <Label>{isService ? ts('servicePriceLabel') : t('priceLabel')}</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={d.price}
            onChange={(e) => set({ price: e.target.value })}
          />
        </div>
        {/* Condition is meaningless for a service — hide it. */}
        {!isService && (
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
        )}
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

      {/* Product features — buyers see the details (not applicable to services). */}
      {!isService && (
        <SpecsEditor
          value={d.specs}
          onChange={(v) => set({ specs: v })}
          suggestions={specSuggestionsFor(categories.find((c) => c.id === d.categoryId)?.slug)}
        />
      )}

      <div className="space-y-1.5">
        <Label>{t('locationLabel')}</Label>
        <Input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Kigali, Nyarugenge" />
        <LocationField
          latitude={d.latitude}
          longitude={d.longitude}
          onChange={(g) =>
            set({
              latitude: g.latitude,
              longitude: g.longitude,
              location: d.location.trim() || g.label || d.location,
            })
          }
        />
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
