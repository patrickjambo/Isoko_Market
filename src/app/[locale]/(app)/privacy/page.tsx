import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <Prose title="Privacy Policy">
      <p>
        Isoko Market is committed to protecting your personal data in line with Rwanda&apos;s
        Law No. 058/2021 on the Protection of Personal Data and Privacy.
      </p>
      <h2>What we collect</h2>
      <p>
        Your phone number (used as your login), your name and profile details, listings and jobs
        you post, messages you send, and — only if you choose to get verified — a copy of your
        National ID.
      </p>
      <h2>How we use it</h2>
      <p>
        To operate the marketplace and job board, verify identities to keep the platform
        trustworthy, deliver notifications, and process mobile-money payments for optional premium
        features.
      </p>
      <h2>ID documents</h2>
      <p>
        Your National ID is encrypted, never shown publicly, accessed only by our trust team for
        verification, and served through short-lived signed links. You can request its deletion at
        any time.
      </p>
      <h2>Your rights</h2>
      <p>
        You may access, correct, or delete your personal data, and withdraw consent for ID storage.
        Contact us to exercise these rights. We retain data only as long as needed to provide the
        service or as required by law.
      </p>
    </Prose>
  );
}
