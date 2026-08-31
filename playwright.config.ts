import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config (Section 13). Uses the system Chromium
 * (/usr/bin/chromium) via executablePath so no browser download is needed.
 * The webServer runs `npm run dev` with E2E_TESTING=1, which lets the OTP flow
 * return the code to the client for deterministic login (non-production only).
 */
const CHROMIUM = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    // Drive the system Chromium directly (no channel → executablePath is honored).
    launchOptions: {
      executablePath: CHROMIUM,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  projects: [{ name: 'chromium' }],
  // Reuse an already-running dev server (started with E2E_TESTING=1). If none is
  // up, Playwright starts one — but in CI/sandboxes where child processes are
  // reaped, start it yourself first: `E2E_TESTING=1 npm run dev`.
  webServer: {
    // EMAIL_PROVIDER=console keeps the OTP flow off any real email provider, so
    // tests never depend on (or get throttled by) Resend/Brevo — the code is
    // returned to the client under E2E_TESTING instead.
    command: 'E2E_TESTING=1 EMAIL_PROVIDER=console npm run dev',
    url: 'http://localhost:3000/en',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
