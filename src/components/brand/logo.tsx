import Image from 'next/image';
import { cn } from '@/lib/utils';
import logo from '@/images/logo.png';

/**
 * Zenova brand — the provided logo mark. Kept square so it drops into headers,
 * the footer and icons at any size.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="Zenova"
      width={96}
      height={96}
      priority
      className={cn('h-12 w-12 rounded-md object-contain', className)}
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
