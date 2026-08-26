import 'server-only';
import { env } from './env';

/**
 * SMS delivery abstraction. In development (SMS_PROVIDER=console) the message
 * is printed to the server console so OTP login works with no external service.
 * Implement `pindo` / `africastalking` for production by filling in the adapter.
 */
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

const consoleProvider: SmsProvider = {
  async send(to, message) {
    // eslint-disable-next-line no-console
    console.log(`\n📱 [SMS → ${to}] ${message}\n`);
  },
};

// Placeholder adapters — wired to real gateways in production.
const pindoProvider: SmsProvider = {
  async send(to, message) {
    if (!env.SMS_API_KEY) return consoleProvider.send(to, message);
    await fetch('https://api.pindo.io/v1/sms/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to, text: message, sender: env.SMS_SENDER_ID }),
    });
  },
};

export const sms: SmsProvider =
  env.SMS_PROVIDER === 'pindo' ? pindoProvider : consoleProvider;

export async function sendOtpSms(to: string, code: string): Promise<void> {
  await sms.send(to, `Isoko Market: your verification code is ${code}. It expires in 5 minutes.`);
}
