'use client';

import { useState, useRef } from 'react';
import { Loader2, Send, Check, FileText, AlertCircle, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { SignUpPrompt } from '@/components/auth/sign-up-prompt';
import { docTypeKey } from '@/lib/documents';

export function ApplyButton({
  jobId,
  canApply,
  alreadyApplied,
  requiredDocs = [],
  missingDocs = [],
  documents = [],
}: {
  jobId: string;
  /** True when the seeker has a structured CV OR at least one uploaded document. */
  canApply: boolean;
  alreadyApplied: boolean;
  /** Documents this job asks for, and which of them the seeker still lacks. */
  requiredDocs?: string[];
  missingDocs?: string[];
  /** The seeker's vault documents they can attach to this application. */
  documents?: { id: string; type: string; label: string }[];
}) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const tcv = useTranslations('cv');
  const router = useRouter();
  const { toast } = useToast();
  const user = useSession();
  const [open, setOpen] = useState(false);
  // Pre-filled with an editable suggested opener (§6 one-click apply).
  const [coverNote, setCoverNote] = useState(() => t('coverNoteSuggested'));
  // Attach all vault documents by default; the applicant can uncheck any.
  const [currentDocs, setCurrentDocs] = useState(documents);
  const [currentMissingDocs, setCurrentMissingDocs] = useState(missingDocs);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(() => documents.map((d) => d.id));
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [applied, setApplied] = useState(alreadyApplied);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<string>('OTHER');

  const toggleDoc = (id: string) =>
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function onDirectUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadType = pendingTypeRef.current;
    setUploadingDoc(uploadType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', uploadType);
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'Upload failed');
      const newDoc = j as { id: string; type: string; label: string };
      setCurrentDocs((prev) => [newDoc, ...prev]);
      setSelectedDocs((prev) => [newDoc.id, ...prev]);
      setCurrentMissingDocs((prev) => prev.filter((x) => x !== uploadType));
      router.refresh();
      toast(tcv('docUploaded'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingDoc(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function triggerUpload(type: string) {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }

  if (applied) {
    return (
      <Button disabled variant="secondary">
        <Check className="h-4 w-4" /> {t('applied')}
      </Button>
    );
  }

  if (!user) {
    // Gated guest action → explain why + preserve context through sign-up (§5).
    return <SignUpPrompt reason={t('gateApply')} triggerLabel={t('apply')} />;
  }

  // No CV and no uploaded document — send the user to the CV page, where they can
  // either build a CV or upload one (Section 6.3).
  if (!canApply) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="accent">{t('apply')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('apply')}</DialogTitle>
            <DialogDescription>{t('needCv')}</DialogDescription>
          </DialogHeader>
          <Button asChild>
            <Link href="/cv">
              <FileText className="h-4 w-4" /> {t('buildCvCta')}
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  async function apply() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverNote, documentIds: selectedDocs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(t('applied'), 'success');
      setApplied(true);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">{t('applyWithCv')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('applyWithCv')}</DialogTitle>
          <DialogDescription>{t('applyingWith')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" /> {t('snapshotNote')}
        </div>

        {/* Required-documents checklist — show what the job asks for and flag
            anything the seeker hasn't uploaded, with an inline upload shortcut. */}
        {requiredDocs.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold">{t('requiredDocsTitle')}</p>
            <ul className="space-y-1">
              {requiredDocs.map((d) => {
                const missing = currentMissingDocs.includes(d);
                return (
                  <li key={d} className="flex items-center gap-2 text-sm">
                    {missing ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
                    ) : (
                      <Check className="h-4 w-4 shrink-0 text-success" />
                    )}
                    <span className={missing ? 'text-foreground' : 'text-muted-foreground'}>
                      {tcv(docTypeKey(d))}
                    </span>
                    {missing && (
                      <button
                        type="button"
                        onClick={() => triggerUpload(d)}
                        disabled={uploadingDoc === d}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {uploadingDoc === d ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {t('docMissing')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {currentMissingDocs.length > 0 && (
              <p className="text-xs text-muted-foreground">{t('uploadMissingDocs')}</p>
            )}
          </div>
        )}

        {/* Hidden file input shared by all inline upload triggers */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onDirectUpload}
        />

        {/* Supporting documents — pick which vault files to attach. Each selected
            file is snapshotted with the application (immutable). */}
        {currentDocs.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold">{t('attachDocsTitle')}</p>
            <ul className="space-y-1">
              {currentDocs.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(d.id)}
                      onChange={() => toggleDoc(d.id)}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{tcv(docTypeKey(d.type))}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Link href="/cv" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" /> {t('attachDocsAddMore')}
            </Link>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('coverNoteLabel')}</label>
          <Textarea
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder={t('coverNotePlaceholder')}
            rows={4}
          />
        </div>
        <Button onClick={apply} disabled={loading} variant="accent">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {tc('submit')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
