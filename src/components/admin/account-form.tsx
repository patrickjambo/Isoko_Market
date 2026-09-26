'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

/**
 * Admin self-service credentials — change the login email and/or password used
 * for the staff password login. Re-authenticated with the current password.
 */
export function AccountForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations('adminAccount');
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword && newPassword !== confirm) {
      setError(t('mismatch'));
      return;
    }
    const emailChanged = email.trim().toLowerCase() !== currentEmail.toLowerCase();
    if (!emailChanged && !newPassword) {
      setError(t('nothingToChange'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          ...(emailChanged ? { email: email.trim().toLowerCase() } : {}),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(t('saved'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-5">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t('newPasswordLabel')}</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
      </div>

      {newPassword && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t('confirmLabel')}</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-4">
        <Label htmlFor="currentPassword">{t('currentPasswordLabel')}</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t('currentPasswordPlaceholder')}
          autoComplete="current-password"
          required
        />
        <p className="text-xs text-muted-foreground">{t('reauthHint')}</p>
      </div>

      <Button type="submit" disabled={loading || !currentPassword}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>
    </form>
  );
}
