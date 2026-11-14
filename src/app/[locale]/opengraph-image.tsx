import { ImageResponse } from 'next/og';
import { env } from '@/lib/env';

export const runtime = 'edge';
export const alt = 'Zenova Rwanda | Buy & Sell';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default Open Graph image served for all pages that don't have their own
 * opengraph-image route — homepage, marketplace index, jobs index, etc.
 * WhatsApp, Facebook, Twitter/X and others auto-pick this via og:image.
 */
export default function DefaultOgImage() {
  const logoUrl = `${env.NEXT_PUBLIC_APP_URL}/icon-512.png`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0b6b62 0%, #0d8a7f 60%, #0f9e91 100%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          gap: '32px',
        }}
      >
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Zenova"
            width={120}
            height={120}
            style={{ borderRadius: '20px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 900,
                letterSpacing: '-2px',
                lineHeight: 1,
              }}
            >
              Zenova
            </span>
            <span style={{ fontSize: 28, color: '#a3f0e8', fontWeight: 500 }}>Rwanda</span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: '#d1f5f1',
            letterSpacing: '-0.5px',
            textAlign: 'center',
          }}
        >
          Buy & Sell · Find Services · Get a Job
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            fontSize: 22,
            color: '#a3f0e8',
            textAlign: 'center',
          }}
        >
          Rwanda's trusted online marketplace · zenova.rw
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['📱 Electronics', '👗 Fashion', '🏠 Home', '🚗 Vehicles', '💼 Jobs'].map((label) => (
            <div
              key={label}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: '100px',
                padding: '8px 20px',
                fontSize: 20,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
