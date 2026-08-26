'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

/** Report/flag control feeding the admin moderation queue (Section 6.1). */
export function ReportDialog({
  targetType,
  targetId,
  label,
}: {
  targetType: 'LISTING' | 'JOB' | 'USER' | 'MESSAGE';
  targetId: string;
  label: string;
}) {
  const t = useTranslations('trust');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('reasonSpam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const reasons = ['reasonSpam', 'reasonProhibited', 'reasonOffensive', 'reasonOther'];

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason: t(reason), details }),
      });
      if (!res.ok) throw new Error();
      toast(t('reportThanks'), 'success');
      setOpen(false);
      setDetails('');
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reason">{t('reportReason')}</Label>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="…"
            rows={3}
          />
          <Button onClick={submit} disabled={loading} variant="destructive" className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('reportSubmit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
