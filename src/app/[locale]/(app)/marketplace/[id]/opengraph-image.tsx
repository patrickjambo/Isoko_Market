import { ImageResponse } from 'next/og';
import { getListing } from '@/lib/queries';
import { env } from '@/lib/env';

// Default nodejs runtime so Prisma Client can fetch the listing data
export const alt = 'Zenova Rwanda Listing';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Dynamic Open Graph image for each listing — generated at request time by
 * Next.js using the @vercel/og (Satori) renderer. Produces a 1200×630 image
 * with the listing title, price, and location overlaid on a branded background.
 * WhatsApp, Facebook, iMessage, and Telegram all pick this up automatically
 * through the og:image meta tag.
 */
export default async function ListingOgImage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const listing = await getListing(params.id).catch(() => null);

  const title = listing?.title ?? 'Listing on Zenova Rwanda';
  const price =
    listing?.price && listing.price > 0
      ? `${Math.round(listing.price / 100).toLocaleString()} RWF`
      : 'Price on request';
  const location = listing?.location ?? 'Rwanda';

  // Use the first listing image if available; fall back to the brand logo.
  const coverUrl = (() => {
    const raw = listing?.images?.[0]?.url;
    if (!raw) return `${env.NEXT_PUBLIC_APP_URL}/icon-512.png`;
    return raw.startsWith('http') ? raw : `${env.NEXT_PUBLIC_APP_URL}${raw}`;
  })();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#0b6b62',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left: listing image */}
        <div
          style={{
            display: 'flex',
            width: '50%',
            height: '100%',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Right: text panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '50%',
            padding: '48px',
            color: '#ffffff',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${env.NEXT_PUBLIC_APP_URL}/icon-512.png`}
              alt="Zenova"
              width={48}
              height={48}
              style={{ borderRadius: '8px' }}
            />
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>
              Zenova Rwanda
            </span>
          </div>

          {/* Listing info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                fontSize: title.length > 50 ? 32 : 42,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: '-1px',
              }}
            >
              {title.length > 70 ? title.slice(0, 68) + '…' : title}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a3f0e8' }}>{price}</div>
            <div style={{ fontSize: 20, color: '#d1f5f1' }}>📍 {location}</div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: 18, color: '#a3f0e8' }}>zenova.rw · Buy & Sell in Rwanda</div>
        </div>
      </div>
    ),
    {
      ...size,
      // If the listing image fails to load, the template still renders cleanly.
    }
  );
}
