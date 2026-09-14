'use client';

import { useEffect, useRef } from 'react';

/**
 * Submits the magic-link confirm form automatically on load, so tapping the email
 * button logs the user straight in (one click). The visible button remains as a
 * no-JS fallback. This keeps the prefetch protection: a mail scanner does a bare
 * GET without running JS, so it never auto-submits and never burns the token.
 */
export function MagicAutoSubmit({ formId }: { formId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }, [formId]);
  return null;
}
