import Image from 'next/image';
import { cn } from '@/lib/utils';
import mark from '@/images/logo-mark.png';

/**
 * Zenova brand — the emblem, cropped from the supplied lockup and given a
 * transparent background so it sits cleanly on any surface (no boxed field).
 * Kept roughly square so it drops into headers, the footer and small icons.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={mark}
      alt="Zenova"
      width={102}
      height={108}
      priority
      className={cn('h-12 w-auto object-contain', className)}
    />
  );
}

export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {showText && (
        <span className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Zenova
        </span>
      )}
    </span>
  );
}
