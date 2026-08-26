import { test, expect } from '@playwright/test';
import { apiLogin, apiCreateJob, apiSetCv, apiApply, otpLoginUI, uniquePhone } from './helpers';

const BASE = 'http://localhost:3000';

/**
 * Core employer↔seeker↔hiring journey (Employer spec §5/§6/§10):
 *  employer posts a gig → two seekers build a CV and apply → employer hires one
 *  → the job-filled cascade closes the job and moves every other applicant to
 *  POSITION_FILLED in one transaction, reaching the seeker's Applications panel.
 */
test('employer posts a job, seekers apply, hiring one cascades the rest to Position Filled', async ({
  page,
  request,
  playwright,
}) => {
  // Employer (shared `request` context) posts a gig requiring "tailoring".
  const empPhone = uniquePhone();
  await apiLogin(request, empPhone, { fullName: 'E2E Employer', intent: 'hire' });
  const title = `E2E Tailor Gig ${Date.now()}`;
  const jobId = await apiCreateJob(request, {
    title,
    description: 'Short-term tailoring help for the E2E hiring journey.',
    type: 'GIG',
    location: 'Kigali, Nyarugenge',
    skills: ['tailoring'],
  });

  // Seeker A — own API context + CV — applies.
  const seekerA = await playwright.request.newContext({ baseURL: BASE });
  const aPhone = uniquePhone();
  await apiLogin(seekerA, aPhone, { fullName: 'E2E Seeker A', intent: 'find_work' });
  await apiSetCv(seekerA, ['tailoring', 'sales']);
  const appA = await apiApply(seekerA, jobId);

  // Seeker B — applies too; used for the cascade UI assertion below.
  const seekerB = await playwright.request.newContext({ baseURL: BASE });
  const bPhone = uniquePhone();
  await apiLogin(seekerB, bPhone, { fullName: 'E2E Seeker B', intent: 'find_work' });
  await apiSetCv(seekerB, ['tailoring']);
  await apiApply(seekerB, jobId);

  // Employer hires Seeker A → atomic job-filled cascade.
  const patch = await request.patch(`/api/applications/${appA}`, { data: { status: 'HIRED' } });
  expect(patch.ok()).toBeTruthy();
  const body = await patch.json();
  expect(body.status).toBe('HIRED');
  expect(
    body.filledOthers,
    'the other applicant is transitioned in the same server-side transaction'
  ).toBeGreaterThanOrEqual(1);

  // A filled job must leave the OPEN search results (status CLOSED).
  const search = await request.get(`/api/jobs?q=${encodeURIComponent(title)}`);
  const results = await search.json();
  const stillOpen = (results.items ?? []).some((j: { id: string }) => j.id === jobId);
  expect(stillOpen, 'a filled job must not appear in open search').toBeFalsy();

  await seekerA.dispose();
  await seekerB.dispose();

  // Seeker B sees "Position filled" on their Applications panel — the cascade
  // status reaching the other side through the real UI (§7/§10).
  await otpLoginUI(page, bPhone);
  await page.goto('/en/profile/applications');
  await expect(page.getByText(/position filled/i)).toBeVisible();
});
