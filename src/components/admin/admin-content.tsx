'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';

type Entry = { key: string; base: string; value: string };
const LOCALES = ['rw', 'en', 'fr'];

export function AdminContent() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const can = useCan();
  const canEdit = can('content.edit');
  const [locale, setLocale] = useState('rw');
  const [q, setQ] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ locale });
      if (q.trim()) sp.set('q', q.trim());
      const { data } = await adminApi<{ entries: Entry[] }>(`/api/admin/content?${sp}`);
      setEntries(data.entries);
      setDrafts(Object.fromEntries(data.entries.map((e) => [e.key, e.value])));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [locale, q, toast]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  async function save(key: string) {
    setSavingKey(key);
    try {
      await adminApi('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, key, value: drafts[key] ?? '' }),
      });
      toast(t('actionLogged'), 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={locale} onChange={(e) => setLocale(e.target.value)} className="sm:max-w-[160px]">
          {LOCALES.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </Select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchStrings')} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.key} className="rounded-xl border border-border bg-card p-3">
              <p className="mb-1 font-mono text-xs text-muted-foreground">{e.key}</p>
              <p className="mb-2 text-xs text-muted-foreground">
                {t('defaultLabel')}: <span className="text-foreground">{e.base}</span>
              </p>
              <div className="flex gap-2">
                <Input
                  value={drafts[e.key] ?? ''}
                  onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                  placeholder={e.base}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button size="icon" variant="outline" onClick={() => save(e.key)} disabled={savingKey === e.key}>
                    {savingKey === e.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
