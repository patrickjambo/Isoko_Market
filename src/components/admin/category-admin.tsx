'use client';

import { useState } from 'react';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

export type AdminCategory = {
  id: string;
  nameEn: string;
  nameRw: string;
  nameFr: string;
  kind: 'PRODUCT' | 'SERVICE';
  listingCount: number;
  sellerAdded: boolean;
};

/** Admin row actions to curate a category: rename/re-kind, or delete. */
export function CategoryAdmin({ category }: { category: AdminCategory }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nameEn: category.nameEn,
    nameRw: category.nameRw,
    nameFr: category.nameFr,
    kind: category.kind,
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(tc('save'), 'success');
      setOpen(false);
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(t('categoryDeleteConfirm', { count: category.listingCount }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(tc('deleted'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categoryEditTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>English</Label>
              <Input value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>Kinyarwanda</Label>
              <Input value={form.nameRw} onChange={(e) => setForm((f) => ({ ...f, nameRw: e.target.value }))} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>Français</Label>
              <Input value={form.nameFr} onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('categoryKind')}</Label>
              <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as 'PRODUCT' | 'SERVICE' }))}>
                <option value="PRODUCT">{t('categoryProduct')}</option>
                <option value="SERVICE">{t('categoryService')}</option>
              </Select>
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tc('save')}
          </Button>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={remove} disabled={deleting}>
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
      </Button>
    </div>
  );
}
