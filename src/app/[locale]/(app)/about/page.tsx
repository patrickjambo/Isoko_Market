import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';

export const metadata = { title: 'About' };

export default function AboutPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <Prose title="About Isoko Market">
      <p>
        Isoko Market exists to reduce youth unemployment and digital exclusion in Rwanda through a
        trusted, accessible and affordable platform to buy, sell, and find work.
      </p>
      <p>
        We bring commerce and employment together in one place: a verified marketplace, a job board
        with a built-in CV builder, mobile-money payments, and a fully multilingual experience in
        Kinyarwanda, English and French — designed to work well even on slow connections and older
        phones.
      </p>
      <h2>Our commitment to trust</h2>
      <p>
        Every profile shows a verification status, so you always know who you are dealing with.
        Verification keeps the community safe while keeping the barrier to entry low.
      </p>
    </Prose>
  );
}
