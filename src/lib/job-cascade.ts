import 'server-only';
import { prisma } from './prisma';
import { publish, publishTopic } from './realtime';
import { notify } from './notifications';

/**
 * Job-filled → auto-close cascade (§10).
 *
 * When a job is filled (a candidate hired, or the employer closes the posting)
 * every still-pending applicant is moved to POSITION_FILLED in ONE transaction —
 * rather than being left in permanent limbo — and each is notified in real time
 * (WebSocket/SSE + persisted, with SMS fallback for offline seekers).
 *
 * @param jobId          the job being filled/closed
 * @param exceptApplicantId  the hired applicant (if any) to leave untouched
 * @returns the number of applicants transitioned
 */
const PENDING = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW'] as const;

export async function cascadeJobFilled(
  jobId: string,
  exceptApplicantId?: string
): Promise<number> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, title: true },
  });
  if (!job) return 0;

  // Everyone still in the running (minus the hired candidate).
  const pending = await prisma.application.findMany({
    where: {
      jobId,
      status: { in: [...PENDING] },
      ...(exceptApplicantId ? { applicantId: { not: exceptApplicantId } } : {}),
    },
    select: { id: true, applicantId: true },
  });

  // Atomic: close the job and transition every pending applicant together.
  await prisma.$transaction([
    prisma.job.update({ where: { id: jobId }, data: { status: 'CLOSED' } }),
    ...(pending.length
      ? [
          prisma.application.updateMany({
            where: { id: { in: pending.map((p) => p.id) } },
            data: { status: 'POSITION_FILLED' },
          }),
        ]
      : []),
  ]);

  // Live-propagate to anyone viewing the job. reason:'filled' distinguishes this
  // from a manual close (rule 6 disambiguation).
  publishTopic(`job:${jobId}`, { type: 'entity_update', entity: 'job', id: jobId, status: 'CLOSED', reason: 'filled' });

  // Notify each affected applicant (real-time + persisted + SMS-if-offline).
  await Promise.all(
    pending.map(async (p) => {
      publish(p.applicantId, {
        type: 'application_update',
        applicationId: p.id,
        status: 'POSITION_FILLED',
      });
      await notify({
        userId: p.applicantId,
        type: 'APPLICATION_UPDATE',
        title: job.title,
        body: `This position has been filled`,
        href: '/profile/applications',
        payload: { jobId, applicationId: p.id, status: 'POSITION_FILLED' },
      });
    })
  );

  return pending.length;
}
