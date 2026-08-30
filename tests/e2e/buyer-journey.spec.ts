import { test, expect } from '@playwright/test';
import { apiLogin, apiSetPayment, apiCreateListing, otpRegisterUI, uniqueEmail } from './helpers';

/**
 * Core buyer↔seller manual-P2P journey (buyer spec §6/§7/§10):
 *  seller sets a payout number + lists (API) → buyer registers (UI) → opens the
 *  listing → Buy Now → sees the seller's MoMo number → "I've sent the payment"
 *  → seller confirms the money arrived → buyer confirms receipt → reviews.
 *
 * No escrow / no payment API: money moves off-platform, both sides confirm
 * in-app, and the item only completes once the buyer acknowledges receipt.
 */
test('buyer pays the seller directly, both confirm, and the buyer reviews', async ({ page, request }) => {
  // Seller (API context) with a payout number set + an active listing. The
  // payout number gates Buy Now — without it the listing can't be ordered.
  await apiLogin(request, uniqueEmail('seller'), { fullName: 'E2E Seller', role: 'SELLER' });
  await apiSetPayment(request, { number: '+250788111111', provider: 'mtn_momo' });
  const title = `E2E Test Bicycle ${Date.now()}`;
  const listingId = await apiCreateListing(request, {
    title,
    description: 'A great test bicycle in good condition for the E2E journey.',
    price: 45000,
    location: 'Kigali, Nyarugenge',
  });

  // Buyer registers through the UI.
  await otpRegisterUI(page, { email: uniqueEmail('buyer'), name: 'E2E Buyer', role: 'BUYER' });

  // Open the listing — Buy Now is enabled because the seller has a payout number.
  await page.goto(`/en/marketplace/${listingId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const buyNow = page.getByRole('button', { name: /^buy now$/i });
  await expect(buyNow).toBeEnabled();

  // Buy Now → order summary dialog → Place order → order page.
  await buyNow.click();
  await page.getByRole('button', { name: /^place order$/i }).click();
  await page.waitForURL(/\/en\/orders\/[a-z0-9]+/i);
  const orderId = page.url().match(/\/orders\/([a-z0-9]+)/i)?.[1] ?? '';
  expect(orderId, 'order id parsed from the URL').toBeTruthy();

  // Order opens "awaiting payment"; the seller's payout number is shown to pay.
  await expect(page.getByText('+250788111111')).toBeVisible();

  // Buyer marks the payment as sent → BUYER_MARKED_PAID ("Payment sent").
  await page.getByRole('button', { name: /i've sent the payment/i }).click();
  await expect(page.getByText(/payment sent/i).first()).toBeVisible();

  // Seller confirms the money actually arrived (their side, via API) →
  // SELLER_CONFIRMED. Mutual confirmation is what replaces the escrow release.
  const sellerConfirm = await request.patch(`/api/orders/${orderId}`, { data: { action: 'confirm' } });
  expect(sellerConfirm.ok(), 'seller confirms payment received').toBeTruthy();

  // Buyer refreshes, confirms receipt → COMPLETED, then reviews the seller.
  await page.reload();
  await page.getByRole('button', { name: /confirm receipt/i }).click();
  await expect(page.getByText(/completed/i).first()).toBeVisible();

  // Review the seller (5 stars) — write once, seller rating updates platform-wide.
  const stars = page.getByRole('button', { name: '5' });
  await expect(stars).toBeVisible();
  await stars.click();
  await page.getByRole('button', { name: /submit review/i }).click();
  await expect(page.getByText(/thanks for your feedback/i)).toBeVisible();
});
