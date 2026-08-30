import { type Page, type APIRequestContext, expect } from '@playwright/test';

/** A unique, valid email for isolated test users (auth is now email-based). */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.rw`;
}

/**
 * Register (or log in) through the real email-OTP UI. Under E2E_TESTING=1 the
 * request-otp response returns the code, so we can drive the whole flow.
 */
export async function otpRegisterUI(
  page: Page,
  opts: { email: string; name: string; role?: 'BUYER' | 'SELLER' | 'EMPLOYER' }
) {
  await page.goto('/en/register');
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Email address').fill(opts.email);
  if (opts.role) await page.getByLabel('I mainly want to').selectOption(opts.role);

  const codePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/request-otp') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /send code/i }).click();
  const { code } = await (await codePromise).json();
  expect(code, 'E2E OTP code should be returned under E2E_TESTING').toBeTruthy();

  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: /verify & continue/i }).click();
  await page.waitForURL(/\/en\/?$/);
}

/** Log a user in via the API (sets cookies on the request context). */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  extra: Record<string, unknown> = {}
) {
  const r1 = await request.post('/api/auth/request-otp', { data: { email } });
  const { code } = await r1.json();
  const r2 = await request.post('/api/auth/verify-otp', { data: { email, code, ...extra } });
  expect(r2.ok()).toBeTruthy();
}

/**
 * Set the current user's payout number + provider (via API). A seller must have
 * one before their listings can be ordered (manual-P2P Buy Now gate).
 */
export async function apiSetPayment(
  request: APIRequestContext,
  opts: { number: string; provider?: 'mtn_momo' | 'airtel_money' } = { number: '+250788111111' }
): Promise<void> {
  const res = await request.patch('/api/profile', {
    data: { paymentNumber: opts.number, paymentProvider: opts.provider ?? 'mtn_momo' },
  });
  expect(res.ok(), 'setting the seller payout number should succeed').toBeTruthy();
}

/** Create an active listing via the API; returns its id. */
export async function apiCreateListing(
  request: APIRequestContext,
  data: { title: string; description: string; price: number; location: string }
): Promise<string> {
  const res = await request.post('/api/listings', { data });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id as string;
}

/** Post a job/gig via the API; returns its id. */
export async function apiCreateJob(
  request: APIRequestContext,
  data: { title: string; description: string; type?: 'JOB' | 'GIG'; location: string; skills?: string[] }
): Promise<string> {
  const res = await request.post('/api/jobs', { data: { type: 'JOB', skills: [], ...data } });
  expect(res.ok(), 'job create should succeed').toBeTruthy();
  const json = await res.json();
  return json.id as string;
}

/** Set the current user's CV (skills), so they can apply. */
export async function apiSetCv(request: APIRequestContext, skills: string[]): Promise<void> {
  const res = await request.put('/api/cv', {
    data: { headline: 'E2E candidate', summary: '', education: [], experience: [], skills, languages: [] },
  });
  expect(res.ok(), 'cv save should succeed').toBeTruthy();
}

/** Apply to a job via the API; returns the application id. */
export async function apiApply(
  request: APIRequestContext,
  jobId: string,
  coverNote = 'Available immediately'
): Promise<string> {
  const res = await request.post(`/api/jobs/${jobId}/apply`, { data: { coverNote } });
  expect(res.ok(), 'apply should succeed').toBeTruthy();
  const json = await res.json();
  return json.id as string;
}

/**
 * Register through the real email-OTP UI carrying an onboarding intent (?intent=…),
 * e.g. hire / find_work. Lands on that intent's onboarding screen.
 */
export async function registerWithIntentUI(
  page: Page,
  opts: { email: string; name: string; intent: 'buy_sell' | 'find_work' | 'hire' | 'browse' }
) {
  await page.goto(`/en/register?intent=${opts.intent}`);
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Email address').fill(opts.email);

  const codePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/request-otp') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /send code/i }).click();
  const { code } = await (await codePromise).json();
  expect(code).toBeTruthy();

  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: /verify & continue/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/register'));
}

/** Log an existing user in through the email-OTP UI. Waits until off the login page. */
export async function otpLoginUI(page: Page, email: string) {
  await page.goto('/en/login');
  await page.getByLabel('Email address').fill(email);

  const codePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/request-otp') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /send code/i }).click();
  const { code } = await (await codePromise).json();
  expect(code).toBeTruthy();

  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: /verify & continue/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

/** Clear the session (server-side) so the next navigation is logged-out. */
export async function logoutUI(page: Page) {
  await page.request.post('/api/auth/logout');
}
