import { type Page, type APIRequestContext, expect } from '@playwright/test';

/** A unique valid Rwandan mobile number for isolated test users. */
export function uniquePhone(): string {
  return '078' + String(Math.floor(1_000_000 + Math.random() * 8_999_999));
}

/**
 * Register (or log in) through the real OTP UI. Under E2E_TESTING=1 the
 * request-otp response returns the code, so we can drive the whole flow.
 */
export async function otpRegisterUI(
  page: Page,
  opts: { phone: string; name: string; role?: 'BUYER' | 'SELLER' | 'EMPLOYER' }
) {
  await page.goto('/en/register');
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Phone number').fill(opts.phone);
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
  phone: string,
  extra: Record<string, unknown> = {}
) {
  const r1 = await request.post('/api/auth/request-otp', { data: { phone } });
  const { code } = await r1.json();
  const r2 = await request.post('/api/auth/verify-otp', { data: { phone, code, ...extra } });
  expect(r2.ok()).toBeTruthy();
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
 * Register through the real OTP UI carrying an onboarding intent (?intent=…),
 * e.g. hire / find_work. Lands on that intent's onboarding screen.
 */
export async function registerWithIntentUI(
  page: Page,
  opts: { phone: string; name: string; intent: 'buy_sell' | 'find_work' | 'hire' | 'browse' }
) {
  await page.goto(`/en/register?intent=${opts.intent}`);
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Phone number').fill(opts.phone);

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

/** Log an existing user in through the OTP UI. Waits until off the login page. */
export async function otpLoginUI(page: Page, phone: string) {
  await page.goto('/en/login');
  await page.getByLabel('Phone number').fill(phone);

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
