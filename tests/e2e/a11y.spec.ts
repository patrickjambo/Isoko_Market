import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Rule 7 (accessibility) — automated WCAG 2.0/2.1 A+AA scan of the key public
 * screens in ALL THREE locales (Kinyarwanda default, English, French), so a
 * regression that breaks accessibility on any locale fails the build. We gate on
 * SERIOUS + CRITICAL impact violations (the ones that actually block users);
 * minor/moderate findings are surfaced but not failed.
 */
const LOCALES = ['rw', 'en', 'fr'] as const;
const PAGES = ['', '/marketplace', '/jobs', '/get-started', '/login'] as const;

for (const locale of LOCALES) {
  for (const path of PAGES) {
    const url = `/${locale}${path}`;
    test(`a11y (WCAG A/AA): ${url}`, async ({ page }) => {
      // `goto` resolves on 'load'; avoid networkidle (flaky on image-heavy pages).
      await page.goto(url);
      await page.getByRole('main').or(page.locator('body')).first().waitFor();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      const summary = blocking.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));
      expect(blocking, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }
}
