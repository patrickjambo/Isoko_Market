'use client';

import { useState, useEffect } from 'react';
import { Star, Loader2, MessageSquarePlus } from 'lucide-react';
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

  // Pre-fill user name if logged in
  useEffect(() => {
    if (sessionUser?.fullName && !name) {
      setName(sessionUser.fullName);
    }
  }, [sessionUser, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError('Please provide a valid name (at least 2 characters).');
      return;
    }
    if (!comment.trim() || comment.trim().length < 5) {
      setError('Please provide a comment with at least 5 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          comment: comment.trim(),
          rating,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      toast(t('successToast'), 'success');
      onSuccess(data.feedback);
      onOpenChange(false);
      setComment('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errorToast');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <MessageSquarePlus className="h-5 w-5" />
            <DialogTitle>{t('modalTitle')}</DialogTitle>
          </div>
          <DialogDescription>{t('modalSubtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Star rating picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('ratingLabel')}</Label>
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
                      className={`h-6 w-6 transition-colors ${
                        active
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-transparent text-muted-foreground/40'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-sm font-semibold text-foreground/80">
                {hoverRating ?? rating}/5
              </span>
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-1.5">
            <Label htmlFor="feedback-name" className="text-sm font-medium">
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
            />
          </div>

          {/* Comment textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="feedback-comment" className="text-sm font-medium">
                {t('commentLabel')}
              </Label>
              <span className="text-xs text-muted-foreground">
                {comment.length}/500
              </span>
            </div>
            <Textarea
              id="feedback-comment"
              required
              rows={4}
              minLength={5}
              maxLength={500}
              placeholder={t('commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {t('cancelBtn')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="min-w-[130px] rounded-full bg-[#056349] hover:bg-[#04523c] text-white font-bold"
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
