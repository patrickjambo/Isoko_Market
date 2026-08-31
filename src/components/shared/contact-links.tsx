import { Phone, MessageCircle, Mail, Instagram } from 'lucide-react';
import { telLink, whatsappLink, instagramLink, type ContactChannels } from '@/lib/contact';
import { cn } from '@/lib/utils';

/**
 * Renders a poster's structured contact as tap-to-contact buttons — call,
 * WhatsApp, email, Instagram — showing only the channels they provided. Plain
 * links, so it works in a server component (no client JS).
 */
export function ContactLinks({ contact }: { contact: ContactChannels | null }) {
  if (!contact) return null;

  const items = [
    contact.phone && { href: telLink(contact.phone), Icon: Phone, label: contact.phone, cls: 'text-primary' },
    contact.whatsapp && { href: whatsappLink(contact.whatsapp), Icon: MessageCircle, label: 'WhatsApp', cls: 'text-emerald-600', external: true },
    contact.email && { href: `mailto:${contact.email}`, Icon: Mail, label: contact.email, cls: 'text-primary' },
    contact.instagram && { href: instagramLink(contact.instagram), Icon: Instagram, label: `@${contact.instagram}`, cls: 'text-pink-600', external: true },
  ].filter(Boolean) as { href: string; Icon: typeof Phone; label: string; cls: string; external?: boolean }[];

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ href, Icon, label, cls, external }) => (
        <a
          key={href}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary/50"
        >
          <Icon className={cn('h-4 w-4', cls)} /> {label}
        </a>
      ))}
    </div>
  );
}
