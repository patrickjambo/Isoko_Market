'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { intentHome, type Intent } from '@/lib/onboarding';

type Mode = 'login' | 'register';
type Step = 'email' | 'otp' | 'password';

export function AuthForm({
  mode,
  referralCode,
  intent,
  returnTo,
}: {
  mode: Mode;
  referralCode?: string;
  intent?: Intent;
  returnTo?: string;
}) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'BUYER' | 'SELLER' | 'EMPLOYER'>('BUYER');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [forcedOtp, setForcedOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devHint, setDevHint] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function requestOtp(e?: React.FormEvent, opts?: { forceOtp?: boolean }) {
    e?.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('emailLabel'));
      return;
    }
    if (mode === 'register' && fullName.trim().length < 2) {
      setError(t('fullNameLabel'));
      return;
    }
    if (opts?.forceOtp) setForcedOtp(true);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mode, locale, ...(opts?.forceOtp ? { forceOtp: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Logging in with an email that has no account → send them to onboarding
        // to register with a goal + name (login never creates accounts).
        if (mode === 'login' && data.error?.code === 'NOT_FOUND') {
          toast(t('loginNoAccount'), 'error');
          router.push('/get-started');
          return;
        }
        throw new Error(data.error?.message ?? 'error');
      }
      // Staff accounts log in with a password (no OTP) — the server tells us
      // which step to show next.
      if (data.method === 'password') {
        setStep('password');
        return;
      }
      setDevHint(Boolean(data.devHint));
      setStep('otp');
      setResendIn(50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(t('loginTitle'), 'success');
      router.push(returnTo || data.redirectTo || '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          mode,
          ...(mode === 'register'
            ? {
                fullName,
                locale,
                // Intent decides the role server-side; only send an explicit role
                // for the plain /register entry (no intent) so hire→EMPLOYER holds.
                ...(intent ? { intent } : { role }),
                ...(referralCode ? { ref: referralCode } : {}),
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(data.isNew ? t('registerTitle') : t('loginTitle'), 'success');
      // Restore whatever the guest was doing (§5), else use the server's
      // role-aware landing (new → onboarding path; returning → own role home).
      const dest = returnTo || data.redirectTo || (data.isNew ? intentHome(intent) : '/');
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === 'login' ? t('loginTitle') : t('registerTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === 'email'
            ? mode === 'login'
              ? t('loginSubtitle')
              : t('registerSubtitle')
            : step === 'password'
              ? t('staffPasswordSubtitle', { email })
              : t('otpSubtitle', { email })}
        </p>
      </div>

      {mode === 'register' && referralCode && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
          {t('invitedNote')}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 'email' ? (
        <form onSubmit={requestOtp} className="space-y-4" noValidate>
          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t('fullNameLabel')}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                autoComplete="name"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
              required
            />
          </div>
          {/* Intent already picked on the fork → don't ask for a role again.
              Only the plain /register entry shows the role select (§3/§4). */}
          {mode === 'register' && !intent && (
            <div className="space-y-1.5">
              <Label htmlFor="role">{t('roleLabel')}</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="BUYER">{t('roleBuyer')}</option>
                <option value="SELLER">{t('roleSeller')}</option>
                <option value="EMPLOYER">{t('roleEmployer')}</option>
              </Select>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('sendingCode') : t('sendCode')}
          </Button>
        </form>
      ) : step === 'password' ? (
        <form onSubmit={loginWithPassword} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading || !password}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('verifying') : t('login')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setPassword('');
                setError(null);
              }}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {t('changeEmail')}
            </button>
            {/* Forgot password → fall back to a one-time email code. */}
            <button
              type="button"
              onClick={() => requestOtp(undefined, { forceOtp: true })}
              disabled={loading}
              className="font-semibold text-primary hover:underline disabled:text-muted-foreground"
            >
              {t('useCodeInstead')}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="code">{t('otpLabel')}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em]"
              maxLength={6}
              required
              autoFocus
            />
          </div>
          {mode === 'login' && (
            <p className="text-center text-xs text-muted-foreground">{t('otpMagicHint')}</p>
          )}
          {devHint && (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              {t('devCodeHint')}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('verifying') : t('verify')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {t('changeEmail')}
            </button>
            <button
              type="button"
              onClick={() => requestOtp(undefined, { forceOtp: forcedOtp })}
              disabled={resendIn > 0 || loading}
              className="font-semibold text-primary disabled:text-muted-foreground"
            >
              {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resendCode')}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <>
            {t('noAccount')}{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {tc('continue')}
            </Link>
          </>
        ) : (
          <>
            {t('haveAccount')}{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {tc('continue')}
            </Link>
          </>
        )}
      </p>
      <p className="text-center text-xs text-muted-foreground">{t('termsNote')}</p>
    </div>
  );
}
