import 'server-only';
import { getPlatformSettings } from './commission';

export type FeatureFlags = {
  jobsEnabled: boolean;
  hiringEnabled: boolean;
  cvBuilderEnabled: boolean;
};

/**
 * Returns the current feature-flag state from the singleton PlatformSettings row.
 * All flags default to `false` so the platform launches with those features hidden.
 * Admins can flip them on from the admin › settings page without a re-deploy.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const s = await getPlatformSettings();
  return {
    jobsEnabled: s.jobsEnabled,
    hiringEnabled: s.hiringEnabled,
    cvBuilderEnabled: s.cvBuilderEnabled,
  };
}
