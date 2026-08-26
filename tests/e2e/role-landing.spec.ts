import { test, expect } from '@playwright/test';
import { registerWithIntentUI, otpLoginUI, logoutUI, uniquePhone } from './helpers';

/**
 * Regression guard for the role-aware landing fix (Visitor spec §4 / login bug):
 * registration lands on the intent's onboarding screen, and a RETURNING login
 * opens each role on its OWN home — not the generic buyer home for everyone.
 */
test('employer: register → Post-a-Job, and login → employer dashboard', async ({ page }) => {
  const phone = uniquePhone();
  await registerWithIntentUI(page, { phone, name: 'E2E Employer', intent: 'hire' });
  await expect(page, 'hire registration lands on Post-a-Job').toHaveURL(/\/en\/jobs\/new/);

  await logoutUI(page);
  await otpLoginUI(page, phone);
  await expect(page, 'returning employer opens the employer dashboard').toHaveURL(/\/en\/employer/);
});

test('job seeker: register → CV builder, and login → jobs home', async ({ page }) => {
  const phone = uniquePhone();
  await registerWithIntentUI(page, { phone, name: 'E2E Seeker', intent: 'find_work' });
  await expect(page, 'find_work registration lands on the CV builder').toHaveURL(/\/en\/cv/);

  await logoutUI(page);
  await otpLoginUI(page, phone);
  await expect(page, 'returning seeker opens the jobs home').toHaveURL(/\/en\/jobs(\/|$|\?)/);
});
