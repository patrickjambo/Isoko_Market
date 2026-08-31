import 'server-only';
import { env } from './env';

/**
 * Email delivery abstraction (the auth/OTP + notification channel, replacing
 * SMS). In development (`EMAIL_PROVIDER=console`) messages are printed to the
 * server console so OTP login works with no external service. For real email:
 *   • `resend` + RESEND_API_KEY — but the shared onboarding@resend.dev sender
 *     only delivers to the account owner until you verify a domain.
 *   • `brevo` + BREVO_API_KEY — delivers to ANY recipient once a single sender
 *     address is verified (no domain purchase required), 300 emails/day free.
 */
export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Split an "Name <email>" FROM string into Brevo's { name, email } shape. */
function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  const addr = m?.[2]?.trim();
  if (addr) return { name: m?.[1]?.trim() || 'Isoko Market', email: addr };
  return { name: 'Isoko Market', email: from.trim() };
}

const consoleProvider: EmailProvider = {
  async send(to, subject, text) {
    // eslint-disable-next-line no-console
    console.log(`\n📧 [EMAIL → ${to}] ${subject}\n${text}\n`);
  },
};

const resendProvider: EmailProvider = {
  async send(to, subject, text) {
    // Fall back to the console in dev if the key isn't set yet.
    if (!env.RESEND_API_KEY) return consoleProvider.send(to, subject, text);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) {
      throw new Error(`Email send failed (${res.status})`);
    }
  },
};

const brevoProvider: EmailProvider = {
  async send(to, subject, text) {
    // Fall back to the console if the key isn't set yet.
    if (!env.BREVO_API_KEY) return consoleProvider.send(to, subject, text);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: parseFrom(env.EMAIL_FROM),
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Email send failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
  },
};

export const email: EmailProvider =
  env.EMAIL_PROVIDER === 'resend'
    ? resendProvider
    : env.EMAIL_PROVIDER === 'brevo'
      ? brevoProvider
      : consoleProvider;

/** One-time login/registration code (5-minute TTL, single-use — see otp-service). */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await email.send(
    to,
    'Your Isoko Market verification code',
    `Your Isoko Market code is ${code}. It expires in 5 minutes.\n\nIf you didn't request this, you can ignore this email.`
  );
}

/** Best-effort transactional notification (order updates, etc.). */
export async function sendNotificationEmail(to: string, title: string, body?: string): Promise<void> {
  await email.send(to, `Isoko Market: ${title}`, body ? `${title}\n\n${body}` : title);
}
