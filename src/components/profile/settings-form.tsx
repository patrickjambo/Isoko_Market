'use client';

import { useState } from 'react';
import { Loader2, Camera, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { LocationField } from '@/components/shared/location-field';
import { initials } from '@/lib/utils';

export function SettingsForm({
  initial,
}: {
  initial: {
    fullName: string;
    bio: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    avatarUrl: string | null;
    paymentNumber: string | null;
    paymentProvider: string | null;
  };
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const ts = useTranslations('sell');
  const router = useRouter();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(initial.location);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initial.latitude != null && initial.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null
  );

  async function onAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setAvatarUrl(data.url);
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const paymentNumber = String(form.get('paymentNumber') ?? '').trim();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.get('fullName'),
          bio: form.get('bio'),
          location,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          ...(avatarUrl ? { avatarUrl } : {}),
          // Only send payout details when a number is provided (schema validates it).
          ...(paymentNumber
            ? { paymentNumber, paymentProvider: form.get('paymentProvider') || 'mtn_momo' }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? '');
      }
      toast(tc('save'), 'success');
      router.push('/profile');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : tc('error'), 'error');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20 text-2xl">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback>{initials(initial.fullName)}</AvatarFallback>
          </Avatar>
          <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onAvatar(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">{tc('required')}</Label>
        <Input name="fullName" defaultValue={initial.fullName} required />
      </div>
      <div className="space-y-1.5">
        <Label>{t('title')}</Label>
        <LocationField
          location={location}
          latitude={coords?.latitude ?? null}
          longitude={coords?.longitude ?? null}
          onChange={(g) => {
            setLocation(g.location);
            setCoords(
              g.latitude != null && g.longitude != null
                ? { latitude: g.latitude, longitude: g.longitude }
                : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">{t('locationSavedHint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea name="bio" defaultValue={initial.bio} rows={3} maxLength={500} />
      </div>

      {/* Seller payout details — required before "Buy Now" works on your listings. */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4 text-primary" /> {t('paymentSectionTitle')}
        </div>
        <p className="text-xs text-muted-foreground">{t('paymentSectionHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="paymentProvider">{t('paymentProviderLabel')}</Label>
            <Select name="paymentProvider" defaultValue={initial.paymentProvider ?? 'mtn_momo'}>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="airtel_money">Airtel Money</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentNumber">{t('paymentNumberLabel')}</Label>
            <Input
              name="paymentNumber"
              type="tel"
              inputMode="tel"
              defaultValue={initial.paymentNumber ?? ''}
              placeholder="07XX XXX XXX"
            />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={saving || uploading} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {tc('save')}
      </Button>
    </form>
  );
}
