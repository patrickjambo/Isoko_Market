'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { initials } from '@/lib/utils';

export function SettingsForm({
  initial,
}: {
  initial: { fullName: string; bio: string; location: string; avatarUrl: string | null };
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.get('fullName'),
          bio: form.get('bio'),
          location: form.get('location'),
          ...(avatarUrl ? { avatarUrl } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      toast(tc('save'), 'success');
      router.push('/profile');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
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
        <Label htmlFor="location">{t('title')}</Label>
        <Input name="location" defaultValue={initial.location} placeholder="Kigali" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea name="bio" defaultValue={initial.bio} rows={3} maxLength={500} />
      </div>

      <Button type="submit" size="lg" disabled={saving || uploading} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {tc('save')}
      </Button>
    </form>
  );
}
