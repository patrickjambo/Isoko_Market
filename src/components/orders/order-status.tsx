import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const VARIANT: Record<string, 'secondary' | 'accent' | 'success' | 'destructive' | 'muted'> = {
  PENDING_PAYMENT: 'secondary',
  BUYER_MARKED_PAID: 'accent',
  SELLER_CONFIRMED: 'accent',
  COMPLETED: 'success',
  DISPUTED: 'destructive',
  CANCELLED: 'muted',
  PAYMENT_SENT: 'secondary', // dormant legacy status
};

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations('orders');
  return <Badge variant={VARIANT[status] ?? 'muted'}>{t(`status_${status}`)}</Badge>;
}

/** Visual manual-P2P timeline: Pending payment → Buyer paid → Seller confirmed → Completed. */
export function OrderTimeline({ status }: { status: string }) {
  const t = useTranslations('orders');
  const steps = ['PENDING_PAYMENT', 'BUYER_MARKED_PAID', 'SELLER_CONFIRMED', 'COMPLETED'];
  const currentIndex = steps.indexOf(status);
  const failed = status === 'DISPUTED' || status === 'CANCELLED';

  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const reached = !failed && currentIndex >= i;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                  reached
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                {reached ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('text-center text-[11px]', reached ? 'text-foreground' : 'text-muted-foreground')}>
                {t(`step_${step}`)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-1 h-0.5 flex-1', currentIndex > i && !failed ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
