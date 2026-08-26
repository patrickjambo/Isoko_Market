import { test, expect } from '@playwright/test';
import { otpRegisterUI, apiLogin, apiCreateListing, uniquePhone } from './helpers';

/**
 * Core buyer↔seller↔escrow↔review journey (buyer spec §6/§7/§10):
 *  seller lists (API) → buyer registers (UI) → opens the listing → Buy Now
 *  (escrow) → Confirm Receipt (releases escrow) → leaves a review.
 */
test('buyer buys via escrow, confirms receipt, and reviews the seller', async ({ page, request }) => {
  // Seller + active listing (via API for a stable fixture).
  const sellerPhone = uniquePhone();
  await apiLogin(request, sellerPhone, { fullName: 'E2E Seller', role: 'SELLER' });
  const title = `E2E Test Bicycle ${Date.now()}`;
  const listingId = await apiCreateListing(request, {
    title,
    description: 'A great test bicycle in good condition for the E2E journey.',
    price: 45000,
    location: 'Kigali, Nyarugenge',
  });

  // Buyer registers through the UI.
  await otpRegisterUI(page, { phone: uniquePhone(), name: 'E2E Buyer', role: 'BUYER' });

  // Open the listing — trust signals + Buy Now are present.
  await page.goto(`/en/marketplace/${listingId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const buyNow = page.getByRole('button', { name: /^buy now$/i });
  await expect(buyNow).toBeVisible();

  // Buy Now → escrow checkout → order page.
  await buyNow.click();
  await page.getByRole('button', { name: /pay .* mobile money/i }).click();
  await page.waitForURL(/\/en\/orders\/[a-z0-9]+/);

  // Escrow order created; confirm receipt releases it.
  await expect(page.getByText(/payment sent/i).first()).toBeVisible();
  await page.getByRole('button', { name: /confirm receipt/i }).click();
  await expect(page.getByText(/completed/i).first()).toBeVisible();

  // Review the seller (5 stars) — write once, seller rating updates platform-wide.
  const stars = page.getByRole('button', { name: '5' });
  await expect(stars).toBeVisible();
  await stars.click();
  await page.getByRole('button', { name: /submit review/i }).click();
  await expect(page.getByText(/thanks for your review/i)).toBeVisible();
});
