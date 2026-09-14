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
  send(to: string, subject: string, text: string, html?: string): Promise<void>;
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
  async send(to, subject, text, html) {
    // Fall back to the console in dev if the key isn't set yet.
    if (!env.RESEND_API_KEY) return consoleProvider.send(to, subject, text);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) {
      throw new Error(`Email send failed (${res.status})`);
    }
  },
};

const brevoProvider: EmailProvider = {
  async send(to, subject, text, html) {
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
        ...(html ? { htmlContent: html } : {}),
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
export async function sendOtpEmail(to: string, code: string, magicUrl?: string): Promise<void> {
  const text = [
    `Your Isoko Market code is ${code}. It expires in 5 minutes.`,
    ...(magicUrl ? ['', 'Or just tap this link to log in — no code needed:', magicUrl] : []),
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');

  // HTML variant with a real "Log in" button (falls back to `text` in plain
  // clients). The button opens the confirm page, which logs the user in on load.
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:8px 4px;color:#1c1c1c">
  <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Your Isoko Market code is
    <strong style="font-size:18px;letter-spacing:2px">${code}</strong>. It expires in 5 minutes.</p>
  ${
    magicUrl
      ? `<p style="font-size:15px;line-height:1.5;margin:20px 0 12px">Or just tap the button to log in — no code needed:</p>
  <p style="text-align:center;margin:0 0 8px">
    <a href="${magicUrl}" style="display:inline-block;background:#0b6b62;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 32px;border-radius:10px">Log in to Isoko</a>
  </p>`
      : ''
  }
  <p style="font-size:12px;line-height:1.5;color:#777;margin:24px 0 0">If you didn't request this, you can ignore this email.</p>
</div>`.trim();

  await email.send(to, 'Your Isoko Market verification code', text, html);
}

/** Best-effort transactional notification (order updates, etc.). */
export async function sendNotificationEmail(to: string, title: string, body?: string): Promise<void> {
  await email.send(to, `Isoko Market: ${title}`, body ? `${title}\n\n${body}` : title);
}
