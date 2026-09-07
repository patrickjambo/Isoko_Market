'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Loader2, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { SEEKER_DOC_TYPES, docTypeKey } from '@/lib/documents';

type Doc = {
  id: string;
  type: string;
  label: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "Bring your own document" manager for jobseekers — upload an existing CV,
 * cover letter, certificate, ID, etc. from the device. Files are private and
 * only visible to employers the seeker has applied to (gated download route).
 */
export function DocumentManager() {
  const t = useTranslations('cv');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>('CV');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/documents')
      .then((r) => r.json())
      .then((j) => setDocs(j.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      setDocs((d) => [j as Doc, ...d]);
      toast(t('docUploaded'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setDocs((d) => d.filter((x) => x.id !== id));
      toast(tc('deleted'), 'success');
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{t('documentsTitle')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t('documentsHint')}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">{t('documentType')}</Label>
          <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value)} className="sm:w-52">
            {SEEKER_DOC_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(docTypeKey(ty))}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="sm:mb-0"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('uploadFromDevice')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFile}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t('documentFormats')}</p>

      {/* Reassure the seeker their files are stored — no separate "save" needed;
          uploading IS saving, and employers they apply to can review them. */}
      {!loading && docs.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{t('docsSavedReassure', { count: docs.length })}</span>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {tc('loading')}
          </li>
        ) : docs.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t('noDocuments')}
          </li>
        ) : (
          docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium hover:text-primary hover:underline"
                >
                  {d.label}
                </a>
                <p className="text-xs text-muted-foreground">
                  {t(docTypeKey(d.type))} · {humanSize(d.sizeBytes)}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('docSaved')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tc('delete')}
                onClick={() => remove(d.id)}
                disabled={deleting === d.id}
              >
                {deleting === d.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
