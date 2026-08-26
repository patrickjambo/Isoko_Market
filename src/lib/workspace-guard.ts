import 'server-only';
import type { User } from '@prisma/client';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from './auth';
import { adoptedWorkspaces, landingFor, type Workspace } from './onboarding';

/**
 * Page guard for a role-specific workspace (seller / employer). A visitor who
 * hasn't adopted that workspace is sent to their OWN home instead of landing on
 * someone else's dashboard; an anonymous visitor goes to login. Using
 * {@link adoptedWorkspaces} + {@link landingFor} guarantees no redirect loop
 * (your own primary workspace always passes its own guard).
 *
 * NB: only guard the workspace HOME/management pages — NOT the onboarding routes
 * (`/dashboard/sell`, `/jobs/new`, `/cv`), which a buyer uses to START selling /
 * hiring / job-seeking (those actions are what upgrade their role).
 */
export async function requireWorkspace(
  workspace: Exclude<Workspace, 'buyer'>,
  locale: string
): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  else if (!adoptedWorkspaces(user).includes(workspace)) redirect({ href: landingFor(user), locale });
  return user as User;
}
