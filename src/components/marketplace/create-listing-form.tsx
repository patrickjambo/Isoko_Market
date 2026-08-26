'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ImageUploader } from '@/components/shared/image-uploader';
import { useToast } from '@/components/ui/toast';
import { listingConditions } from '@/lib/validators/listing';

type Category = { id: string; name: string };

export function CreateListingForm({ categories }: { categories: Category[] }) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const { toast } = useToast();

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          price: Number(form.get('price')),
          categoryId: form.get('categoryId') || null,
          condition: form.get('condition'),
          location: form.get('location'),
          images,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.fields) setErrors(data.error.fields);
        throw new Error(data.error?.message ?? te('generic'));
      }
      toast(t('form.publish'), 'success');
      router.push(`/marketplace/${data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : te('generic'), 'error');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label>{t('form.photosLabel')}</Label>
        <ImageUploader value={images} onChange={setImages} max={6} />
      </div>

      <Field label={t('form.titleLabel')} error={errors.title}>
        <Input name="title" placeholder={t('form.titlePlaceholder')} required maxLength={120} />
      </Field>

      <Field label={t('form.descriptionLabel')} error={errors.description}>
        <Textarea
          name="description"
          placeholder={t('form.descriptionPlaceholder')}
          required
          rows={5}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.priceLabel')} error={errors.price}>
          <Input name="price" type="number" inputMode="numeric" min={0} required />
        </Field>
        <Field label={t('form.locationLabel')} error={errors.location}>
          <Input name="location" placeholder="Kigali" required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.categoryLabel')}>
          <Select name="categoryId" defaultValue="">
            <option value="">{tc('all')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('form.conditionLabel')}>
          <Select name="condition" defaultValue="GOOD">
            {listingConditions.map((c) => (
              <option key={c} value={c}>
                {t(`condition.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? t('form.publishing') : t('form.publish')}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
