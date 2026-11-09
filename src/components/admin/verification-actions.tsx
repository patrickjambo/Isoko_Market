'use client';

import { useState } from 'react';
import { Eye, ShieldCheck, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  VerificationReviewModal,
  type VerificationReviewItem,
} from './verification-review-modal';

export function VerificationActions({
  requestId,
  request,
}: {
  requestId: string;
  request?: VerificationReviewItem;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<VerificationReviewItem | null>(
    request ?? null
  );
  const [fetching, setFetching] = useState(false);

  async function openReviewModal() {
    if (activeRequest) {
      setModalOpen(true);
      return;
    }

    setFetching(true);
    try {
      const res = await fetch(`/api/admin/verifications/${requestId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Could not load verification details');
      setActiveRequest(json.data);
      setModalOpen(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error loading details', 'error');
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-1.5 shadow-sm"
        onClick={openReviewModal}
        disabled={fetching}
      >
        {fetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        Review & Verify
      </Button>

      <VerificationReviewModal
        request={activeRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onDecisionSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
