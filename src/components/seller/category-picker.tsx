'use client';

import { useState } from 'react';
import { Plus, Loader2, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string };

/**
 * Category chooser that lets a seller ADD a category when none fits (dynamic
 * categories, §8). The new category is saved server-side and immediately usable;
 * the parent appends it so it also shows for the next seller.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  onAdded,
  kind,
  label,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  onAdded: (cat: Category) => void;
  kind: 'PRODUCT' | 'SERVICE';
  label: string;
}) {
  const t = useTranslations('sell');
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function addCategory() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, kind }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      const cat: Category = { id: j.id, name: j.name };
      onAdded(cat);
      onChange(cat.id);
      toast(t('categoryAdded'), 'success');
      setAdding(false);
      setName('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
            placeholder={t('newCategoryPlaceholder')}
            maxLength={40}
            autoFocus
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={saving || name.trim().length < 2}
            aria-label={t('saveCategory')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName('');
            }}
            aria-label="cancel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> {t('addCategory')}
        </button>
      )}
    </div>
  );
}
