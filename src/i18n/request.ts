import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { routing, type AppLocale } from './routing';
import { getLocaleOverrides, setDeep } from '@/lib/locale-overrides';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    locale = routing.defaultLocale;
  }

  const messages = { ...(await import(`../messages/${locale}.json`)).default } as Record<
    string,
    unknown
  >;

  // Merge admin-editable DB overrides on top of the static catalog, so strings
  // can be changed in the Content panel without a code deploy.
  try {
    const overrides = await getLocaleOverrides(locale);
    for (const [key, value] of Object.entries(overrides)) setDeep(messages, key, value);
  } catch {
    /* overrides are best-effort */
  }

  return { locale, messages: messages as AbstractIntlMessages };
});
