import { test, expect } from '@playwright/test';
import { apiLogin, apiCreateJob, apiSetCv, apiApply, otpLoginUI, uniqueEmail } from './helpers';

const BASE = 'http://localhost:3000';

/**
 * Guards the seeker-visible hiring lifecycle (Employer §4 / seeker §8): an
 * employer moving an applicant through Shortlisted → Interview must reach the
 * seeker's own "My applications" panel — not just a notification. This is the
 * exact path a job seeker relies on to see they're progressing.
 */
test('seeker sees Shortlisted then Interview on their applications panel', async ({
  page,
  request,
  playwright,
}) => {
  // Employer posts a skill-tagged gig.
  await apiLogin(request, uniqueEmail('employer'), { fullName: 'E2E Employer', intent: 'hire' });
  const title = `E2E Tailor Role ${Date.now()}`;
  const jobId = await apiCreateJob(request, {
    title,
    description: 'Short tailoring engagement for the hiring-status E2E.',
    type: 'GIG',
    location: 'Kigali, Nyarugenge',
    skills: ['tailoring'],
  });

  // Seeker (own context) builds a matching CV and applies.
  const seeker = await playwright.request.newContext({ baseURL: BASE });
  const seekerEmail = uniqueEmail('seeker');
  await apiLogin(seeker, seekerEmail, { fullName: 'E2E Seeker', intent: 'find_work' });
  await apiSetCv(seeker, ['tailoring']);
  const appId = await apiApply(seeker, jobId);
  await seeker.dispose();

  // Employer shortlists (their side, via API).
  const shortlisted = await request.patch(`/api/applications/${appId}`, { data: { status: 'SHORTLISTED' } });
  expect(shortlisted.ok(), 'employer shortlists the applicant').toBeTruthy();

  // Seeker opens their applications panel and sees "Shortlisted".
  await otpLoginUI(page, seekerEmail);
  await page.goto('/en/profile/applications');
  await expect(page.getByText(/shortlisted/i)).toBeVisible();

  // Employer schedules the interview (status → INTERVIEW).
  const interview = await request.patch(`/api/applications/${appId}`, { data: { status: 'INTERVIEW' } });
  expect(interview.ok(), 'employer moves the applicant to interview').toBeTruthy();

  // Seeker refreshes → the panel now shows "Interview".
  await page.reload();
  await expect(page.getByText(/interview/i)).toBeVisible();
});
