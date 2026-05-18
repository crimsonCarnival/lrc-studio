import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@ui/button';
import { FloatingInput } from '@ui/floating-input';
import { translateAuthError } from '@/utils/authErrors';
import { FieldError, AvatarBadge, GoogleButton } from './auth-shared';

// ─── Login Step 2 — Password ───────────────────────────────────────────────

export default function LoginPasswordStep({ t, identifierData, onBack, onLogin, onGoogleLogin, onSuccess, onSwitchToForgotPassword }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // autoFocus removed as requested
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError(t('auth.validation.fieldRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.validation.passwordMinLength'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin({ identifier: identifierData.identifier, password });
      onSuccess?.();
    } catch (err) {
      setError(translateAuthError(t, err, 'login', identifierData.identifier));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* User persona card */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-3 mb-8 group w-full text-left"
      >
        <AvatarBadge username={identifierData.username} avatarUrl={identifierData.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-200 truncate">
            {identifierData.username || identifierData.identifier}
          </p>
          <p className="text-xs text-zinc-500 flex items-center gap-1 group-hover:text-primary transition-colors">
            <ArrowLeft className="size-3" />
            {t('auth.notYou', 'Not you? Change account')}
          </p>
        </div>
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight font-heading">
          {identifierData.hasPassword === false
            ? t('auth.signInWithGoogle', 'Sign in with Google to continue.')
            : t('auth.enterPassword', 'Enter your password.')
          }
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {identifierData.hasPassword !== false && (
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <FloatingInput
                ref={inputRef}
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                error={!!error}
                className="pr-11"
              />
              {password && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg z-10"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
            </div>
            <FieldError message={error} />
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-xs text-primary hover:text-primary-dim hover:underline font-semibold transition-colors text-right mt-1"
            >
              {t('auth.forgotPassword', 'Forgot password?')}
            </button>
          </div>
        )}

        {identifierData.hasPassword !== false ? (
          <Button
            type="submit"
            disabled={loading || !password}
            className="h-11 bg-primary hover:bg-primary-dim text-zinc-950 font-bold text-sm rounded-xl disabled:opacity-40 transition-all duration-200 mt-1"
          >
            {loading
              ? <Loader2 className="size-4 animate-spin" />
              : t('auth.loginAction')
            }
          </Button>
        ) : null}

        {(identifierData.hasGoogle || identifierData.hasPassword === false) && (
          <div className="flex flex-col gap-4 mt-2">
            {identifierData.hasPassword !== false && (
              <div className="flex items-center gap-3 px-8">
                <div className="flex-1 h-px bg-zinc-800/40" />
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] leading-none">{t('common.or', 'OR')}</span>
                <div className="flex-1 h-px bg-zinc-800/40" />
              </div>
            )}

            <GoogleButton onClick={onGoogleLogin} t={t} />
          </div>
        )}
      </form>
    </div>
  );
}
