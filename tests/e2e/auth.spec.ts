import { test, expect } from '@playwright/test';
import { otpRegisterUI, uniquePhone } from './helpers';

test('register with phone OTP and land on the home feed', async ({ page }) => {
  await otpRegisterUI(page, { phone: uniquePhone(), name: 'E2E Tester', role: 'BUYER' });

  // Signed in: the header shows the language switcher and a user avatar menu,
  // and the marketing/register CTA is gone.
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.getByRole('button', { name: /log in/i })).toHaveCount(0);
});
