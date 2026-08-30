import 'server-only';
import { env } from './env';

/**
 * Email delivery abstraction (the auth/OTP + notification channel, replacing
 * SMS). In development (`EMAIL_PROVIDER=console`) messages are printed to the
 * server console so OTP login works with no external service; set
 * `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` to send real email in staging/prod.
 */
export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
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

export const email: EmailProvider =
  env.EMAIL_PROVIDER === 'resend' ? resendProvider : consoleProvider;

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
