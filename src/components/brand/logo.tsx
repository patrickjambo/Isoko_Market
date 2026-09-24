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
      width={44}
      height={44}
      priority
      className={cn('h-10 w-10 rounded-md object-cover', className)}
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
        <span className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          Zenova
        </span>
      )}
    </span>
  );
}
