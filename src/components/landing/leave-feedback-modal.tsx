'use client';

import { useState, useEffect } from 'react';
import { Star, Loader2, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface FeedbackItem {
  id: string;
  name: string;
  comment: string;
  rating: number;
  createdAt: string | Date;
}

interface LeaveFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (feedback: FeedbackItem) => void;
}

export function LeaveFeedbackModal({
  open,
  onOpenChange,
  onSuccess,
}: LeaveFeedbackModalProps) {
  const t = useTranslations('community');
  const { toast } = useToast();
  const sessionUser = useSession();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync user name if logged in
  useEffect(() => {
    if (sessionUser?.fullName) {
      setName(sessionUser.fullName);
    }
  }, [sessionUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = sessionUser?.fullName || name.trim();
    if (!sessionUser && (!finalName || finalName.length < 2)) {
      setError('Please provide your name.');
      return;
    }

    if (!comment.trim() || comment.trim().length < 2) {
      setError('Please provide your feedback or review (at least 2 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          comment: comment.trim(),
          rating,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || t('errorToast'));
      }

      toast(t('successToast'), 'success');
      onSuccess(data.feedback);
      onOpenChange(false);
      setComment('');
      if (!sessionUser) setName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errorToast');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const userInitials = sessionUser?.fullName
    ? sessionUser.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-700">
            <MessageSquarePlus className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              {t('modalTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 leading-relaxed">
            {t('modalSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          {/* Star rating picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('ratingLabel')}
            </Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating ?? rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${star} star`}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-sm font-bold text-slate-700">
                {hoverRating ?? rating}/5
              </span>
            </div>
          </div>

          {/* User identity: if logged in, show user profile; if guest, prompt name */}
          {sessionUser ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shadow-sm ring-2 ring-white">
                {userInitials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-medium text-emerald-800">{t('postingAs')}</p>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <p className="truncate text-sm font-bold text-slate-900 leading-tight">
                  {sessionUser.fullName}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="feedback-name" className="text-sm font-medium text-slate-800">
                {t('nameLabel')}
              </Label>
              <Input
                id="feedback-name"
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border-slate-200 focus-visible:ring-emerald-600"
              />
            </div>
          )}

          {/* Comment textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="feedback-comment" className="text-sm font-medium text-slate-800">
                {t('commentLabel')}
              </Label>
              <span className="text-xs text-slate-400 font-medium">
                {comment.length}/500
              </span>
            </div>
            <Textarea
              id="feedback-comment"
              required
              rows={4}
              minLength={2}
              maxLength={500}
              placeholder={t('commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="rounded-2xl border-slate-200 resize-none focus-visible:ring-emerald-600"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="rounded-full px-5 text-sm"
            >
              {t('cancelBtn')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="min-w-[130px] rounded-full bg-[#056349] hover:bg-[#04523c] px-6 text-sm font-bold text-white shadow-md shadow-emerald-950/15"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submitBtn')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
