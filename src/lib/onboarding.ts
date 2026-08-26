/**
 * Onboarding intent mapping (Visitor spec §3/§8). Pure + shared by the intent
 * fork, the registration form and the verify-OTP route so the role written and
 * the first screen shown always agree. Intent NEVER restricts API access — it
 * only chooses the initial path (§8 "not locked in").
 */
export type Intent = 'buy_sell' | 'find_work' | 'hire' | 'browse';

export const INTENTS: Intent[] = ['buy_sell', 'find_work', 'hire', 'browse'];

export function isIntent(v: unknown): v is Intent {
  return typeof v === 'string' && (INTENTS as string[]).includes(v);
}

/** Account role to write for an intent (job seekers & browsers are BUYER-role). */
export function intentToRole(intent?: Intent): 'BUYER' | 'SELLER' | 'EMPLOYER' {
  return intent === 'hire' ? 'EMPLOYER' : 'BUYER';
}

/** The first screen to land on after registering with this intent (§4 Step 4). */
export function intentHome(intent?: Intent | null): string {
  switch (intent) {
    case 'buy_sell':
      return '/marketplace';
    case 'find_work':
      return '/cv';
    case 'hire':
      return '/jobs/new';
    default:
      return '/';
  }
}

/**
 * Default landing for a RETURNING user on login — role-aware so each role opens
 * on its own home instead of everyone getting the generic buyer home.
 *
 * Uses the authoritative `role` (which evolves with usage: BUYER→SELLER on first
 * listing, →EMPLOYER on first job) with `preferredRole` as the tie-breaker for
 * intents that don't change `role` (a job seeker stays BUYER-role). This only
 * sets the DEFAULT view — every surface is still reachable from the nav ("not
 * locked in"). Distinct from {@link intentHome}, which is the first-run
 * onboarding screen (e.g. CV builder / Post-a-Job).
 */
export function landingFor(user: { role: string; preferredRole?: string | null }): string {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'EMPLOYER' || user.preferredRole === 'hire') return '/employer';
  if (user.role === 'SELLER') return '/dashboard';
  if (user.preferredRole === 'find_work') return '/jobs';
  return '/'; // buyers / browsers → personalized buyer home
}

export type Workspace = 'seller' | 'employer' | 'seeker' | 'buyer';

/**
 * The user's PRIMARY workspace, used to prioritize nav/menu ordering so a
 * buyer/seeker/employer never sees "Seller dashboard" ranked first in their own
 * menu. Uses the SAME priority as {@link landingFor} (minus admin, which has its
 * own menu entry):
 *
 *   evolved role  >  signup intent
 *   EMPLOYER-role (or `hire` intent)  >  SELLER-role  >  `find_work` intent  >  buyer
 *
 * i.e. what you've actually DONE (listed → seller, posted a job → employer) wins
 * over the one-time signup intent; a job seeker keeps BUYER-role, so their
 * intent is the tie-breaker; everyone else is a buyer.
 */
export function primaryWorkspace(user: { role: string; preferredRole?: string | null }): Workspace {
  if (user.role === 'EMPLOYER' || user.preferredRole === 'hire') return 'employer';
  if (user.role === 'SELLER') return 'seller';
  if (user.preferredRole === 'find_work') return 'seeker';
  return 'buyer';
}

/**
 * The role-workspaces a user has ADOPTED — the only ones the account menu shows
 * (a buyer sees none and starts selling/hiring from the "+ Post" button, which
 * upgrades their role). Same signals & priority as {@link primaryWorkspace}: role
 * evolves with use (seller/employer), job-seeking keeps BUYER-role so its signal
 * is the signup intent. A user can hold several (e.g. a seller who also seeks work).
 */
export function adoptedWorkspaces(
  user: { role: string; preferredRole?: string | null }
): Exclude<Workspace, 'buyer'>[] {
  const out: Exclude<Workspace, 'buyer'>[] = [];
  if (user.role === 'EMPLOYER' || user.preferredRole === 'hire') out.push('employer');
  if (user.role === 'SELLER') out.push('seller');
  if (user.preferredRole === 'find_work') out.push('seeker');
  return out;
}
