'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2, Building2, Handshake, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type Partner = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  contactName: string | null;
  phone: string | null;
  location: string | null;
};

export function PartnersManager({ initial }: { initial: Partner[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          type: form.get('type'),
          status: form.get('status'),
          contactName: form.get('contactName') || undefined,
          phone: form.get('phone') || undefined,
          location: form.get('location') || undefined,
          tagline: form.get('tagline') || undefined,
          brandColor: form.get('brandColor') || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast(t('addPartner'), 'success');
      setOpen(false);
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setRemovingId(null);
    }
  }

  const typeLabel = (type: string) =>
    ({ COOPERATIVE: t('typeCooperative'), NGO: t('typeNgo'), MSME: t('typeMsme'), GOVERNMENT: t('typeGovernment') })[
      type
    ] ?? type;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('partnersSubtitle')}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> {t('addPartner')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addPartner')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">{t('partnerName')}</Label>
                <Input id="p-name" name="name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-type">{t('partnerType')}</Label>
                  <Select id="p-type" name="type" defaultValue="MSME">
                    <option value="COOPERATIVE">{t('typeCooperative')}</option>
                    <option value="NGO">{t('typeNgo')}</option>
                    <option value="MSME">{t('typeMsme')}</option>
                    <option value="GOVERNMENT">{t('typeGovernment')}</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-status">{t('partnerStatus')}</Label>
                  <Select id="p-status" name="status" defaultValue="ACTIVE">
                    <option value="ACTIVE">{t('statusActive')}</option>
                    <option value="PROSPECT">{t('statusProspect')}</option>
                    <option value="INACTIVE">{t('statusInactive')}</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-contact">{t('partnerContact')}</Label>
                <Input id="p-contact" name="contactName" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">{t('partnerPhone')}</Label>
                  <Input id="p-phone" name="phone" type="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-loc">{t('partnerLocation')}</Label>
                  <Input id="p-loc" name="location" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-tagline">{t('partnerTagline')}</Label>
                <Input id="p-tagline" name="tagline" placeholder={t('partnerTaglineHint')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-brand">{t('partnerBrandColor')}</Label>
                <Input id="p-brand" name="brandColor" placeholder="#0F766E" />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('addPartner')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {initial.length === 0 ? (
        <EmptyState icon={Handshake} title={t('noPartners')} />
      ) : (
        <ul className="space-y-2">
          {initial.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{p.name}</p>
                  <Badge variant="secondary">{typeLabel(p.type)}</Badge>
                  <Badge variant={p.status === 'ACTIVE' ? 'success' : 'muted'}>{p.status}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[p.contactName, p.phone, p.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Link
                href={`/boards/${p.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                title={t('viewBoard')}
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t('viewBoard')}
              </Link>
              <button
                onClick={() => remove(p.id)}
                disabled={removingId === p.id}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t('remove')}
              >
                {removingId === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
