import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Checkbox } from '@ui/checkbox';
import { Music2, Eye, EyeOff, ArrowRight, ArrowLeft, Lightbulb, Loader2 } from 'lucide-react';
import RegistrationBlockedModal from './RegistrationBlockedModal';
import { translateAuthError } from '@/utils/authErrors';
import { auth } from '@/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useThemeSync } from '@/hooks/useThemeSync';
import { FloatingInput } from '@ui/floating-input';

// ─── Sub-components ────────────────────────────────────────────────────────
const REMEMBER_ME_KEY = 'lrc-studio-remember-me';

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive font-medium mt-1 flex items-center gap-1">{message}</p>;
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="px-4 py-3 bg-destructive/10 border border-destructive/25 rounded-xl text-xs text-destructive font-medium leading-relaxed">
      {message}
    </div>
  );
}

function AvatarBadge({ username, avatarUrl, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  const initial = (username || '?')[0].toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-primary/30`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/80 to-accent-purple flex items-center justify-center font-bold text-zinc-950 ring-2 ring-primary/20`}>
      {initial}
    </div>
  );
}

// ─── Background ────────────────────────────────────────────────────────────

function Background() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-zinc-950" />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.75%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }} />
      {/* Gradient orbs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 -right-48 w-[400px] h-[400px] bg-accent-purple/6 rounded-full blur-[100px]" />
      <div className="absolute -bottom-48 left-1/4 w-[500px] h-[500px] bg-accent-blue/5 rounded-full blur-[120px]" />
    </div>
  );
}

// ─── Tip footer ────────────────────────────────────────────────────────────

function TipFooter({ t, seed }) {
  const getRandStr = (key) => {
    const arr = t(key, { returnObjects: true });
    if (Array.isArray(arr) && arr.length > 0) return arr[seed % arr.length];
    return t(key);
  };

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 mt-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
      <Lightbulb className="w-3.5 h-3.5 text-warning/60 shrink-0" />
      <p>{getRandStr('home.tips')}</p>
    </div>
  );
}

// ─── Login Step 1 — Identifier ─────────────────────────────────────────────

function LoginIdentifierStep({ t, onNext, onSwitchToRegister }) {
  const [rememberedIdentifier] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_ME_KEY) || '';
    } catch {
      return '';
    }
  });

  const [identifier, setIdentifier] = useState(rememberedIdentifier);
  const [rememberMe, setRememberMe] = useState(!!rememberedIdentifier);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(t('auth.validation.fieldRequired'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await auth.checkIdentifier(identifier.trim());
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, identifier.trim());
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
      onNext({ identifier: identifier.trim(), ...result });
    } catch (err) {
      setError(translateAuthError(t, err, 'login', identifier.trim()));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight font-sans">
          {rememberedIdentifier ? (
            <Trans 
              i18nKey="auth.loginWelcomeBack" 
              values={{ name: rememberedIdentifier }}
              components={[<span key="0" className="font-heading" />]}
            />
          ) : (
            <Trans 
              i18nKey="auth.loginWelcome" 
              components={[<span key="0" className="font-heading" />]}
            />
          )}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5 font-sans">
          {t('auth.loginSubtitle', 'Enter your username or email to continue.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FloatingInput
            ref={inputRef}
            id="auth-identifier"
            type="text"
            label={t('auth.usernameOrEmail')}
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
            autoComplete="username"
            error={!!error}
          />
          <FieldError message={error} />
        </div>

        <div className="flex items-center gap-2 mb-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Checkbox 
            id="remember-me" 
            checked={rememberMe} 
            onCheckedChange={(checked) => setRememberMe(!!checked)}
            className="border-zinc-700 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <Label 
            htmlFor="remember-me" 
            className="text-xs font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors"
          >
            {t('auth.rememberMe')}
          </Label>
        </div>

        <Button
          type="submit"
          disabled={loading || !identifier.trim()}
          className="h-11 bg-primary hover:bg-primary-dim text-zinc-950 font-bold text-sm rounded-xl gap-2 disabled:opacity-40 transition-all duration-200 mt-1"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>{t('auth.continue', 'Continue')} <ArrowRight className="w-4 h-4" /></>
          }
        </Button>

        <p className="text-xs text-zinc-500 text-center">
          {t('auth.noAccount')}{' '}
          <button type="button" onClick={onSwitchToRegister} className="text-primary hover:text-primary-dim hover:underline font-semibold transition-colors">
            {t('auth.register')}
          </button>
        </p>
      </form>
    </div>
  );
}

// ─── Login Step 2 — Password ───────────────────────────────────────────────

function LoginPasswordStep({ t, identifierData, onBack, onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
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
            <ArrowLeft className="w-3 h-3" />
            {t('auth.notYou', 'Not you? Change account')}
          </p>
        </div>
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight font-heading">
          {t('auth.enterPassword', 'Enter your password.')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <FieldError message={error} />
        </div>

        <Button
          type="submit"
          disabled={loading || !password}
          className="h-11 bg-primary hover:bg-primary-dim text-zinc-950 font-bold text-sm rounded-xl disabled:opacity-40 transition-all duration-200 mt-1"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : t('auth.loginAction')
          }
        </Button>
      </form>
    </div>
  );
}

// ─── Register Form ─────────────────────────────────────────────────────────

function RegisterForm({ t, onSwitchToLogin, onRegister }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');

  const validate = () => {
    const errs = {};
    if (username && username.length < 3) errs.username = t('auth.validation.usernameMinLength');
    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) errs.username = t('auth.validation.usernamePattern');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t('auth.validation.emailInvalid');
    if (!username && !email) errs.username = t('auth.validation.fieldRequired');
    if (!password) errs.password = t('auth.validation.fieldRequired');
    else if (password.length < 8) errs.password = t('auth.validation.passwordMinLength');
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setError('');
    setLoading(true);
    try {
      await onRegister({ username: username || undefined, email: email || undefined, password });
    } catch (err) {
      if (err.status === 403) {
        setBlockedMessage(translateAuthError(t, err, 'register', username || email));
        setShowBlockedModal(true);
      } else {
        setError(translateAuthError(t, err, 'register', username || email));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight font-sans">
          <Trans 
            i18nKey="auth.registerWelcome" 
            components={[<span key="0" className="font-heading" />]}
          />
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">
          {t('auth.registerSubtitle', 'Username or email — at least one is required.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <ErrorBanner message={error} />

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <FloatingInput
            id="reg-username"
            type="text"
            label={t('auth.username')}
            value={username}
            onChange={(e) => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: undefined })); }}
            autoComplete="username"
            maxLength={30}
            error={!!fieldErrors.username}
          />
          <FieldError message={fieldErrors.username} />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <FloatingInput
            id="reg-email"
            type="email"
            label={t('auth.email')}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
            autoComplete="email"
            error={!!fieldErrors.email}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">{t('auth.securePassword', 'Secure password')}</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <FloatingInput
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              label={t('auth.password')}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
              autoComplete="new-password"
              error={!!fieldErrors.password}
              className="pr-11"
            />
            {password && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg z-10"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <FieldError message={fieldErrors.password} />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 bg-primary hover:bg-primary-dim text-zinc-950 font-bold text-sm rounded-xl disabled:opacity-40 transition-all duration-200 mt-2"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : t('auth.registerAction')
          }
        </Button>

        <p className="text-xs text-zinc-500 text-center">
          {t('auth.hasAccount')}{' '}
          <button type="button" onClick={onSwitchToLogin} className="text-primary hover:text-primary-dim hover:underline font-semibold transition-colors">
            {t('auth.login')}
          </button>
        </p>
      </form>

      <RegistrationBlockedModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        errorDetails={blockedMessage}
      />
    </div>
  );
}

// ─── Main AuthPage ──────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t } = useTranslation();
  const { login, register } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  useThemeSync();
  const action = searchParams.get('action') || 'signin';
  usePageTitle();

  // The 'view' state manages internal steps (identifier vs password) 
  // but respects the top-level 'action' (signin vs signup)
  const [view, setView] = useState(() => {
    return action === 'signup' ? 'register' : 'login-identifier';
  });

  const [identifierData, setIdentifierData] = useState(null); // { identifier, username, avatarUrl }
  const [tipSeed] = useState(() => Math.floor(Math.random() * 1000));

  // 1. Sync view state when action changes (e.g. browser back button or direct link)
  useEffect(() => {
    if (action === 'signup') {
      setView('register');
    } else if (action === 'signin' || action === 'sign-in') {
      // If we are already in the password step, don't reset to identifier 
      // unless we actually switched from signup
      setView(prev => prev === 'register' ? 'login-identifier' : prev);
    }
  }, [action]);

  // 2. Sync URL when view state changes manually (e.g. switchView calls)
  useEffect(() => {
    const currentAction = action;
    const targetAction = view === 'register' ? 'signup' : 'signin';
    
    if (currentAction !== targetAction && !(currentAction === 'sign-in' && targetAction === 'signin')) {
      setSearchParams({ action: targetAction }, { replace: true });
    }
  }, [view, action, setSearchParams]);

  const handleIdentifierNext = useCallback((data) => {
    setIdentifierData(data);
    setView('login-password');
  }, []);

  const handleBack = useCallback(() => {
    setIdentifierData(null);
    setView('login-identifier');
  }, []);

  const switchView = useCallback((newView) => {
    setView(newView);
    setIdentifierData(null);
    // Force immediate URL update to be snappy
    setSearchParams({ action: newView === 'register' ? 'signup' : 'signin' }, { replace: true });
  }, [setSearchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 font-sans">
      <Background />

      <div className="relative z-raised w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 flex items-center justify-center mb-3">
            <img 
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png" 
              alt="LRC Studio" 
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(29,185,84,0.3)]"
            />
          </div>
          <p className="text-base font-bold text-zinc-100 tracking-tight font-heading">{t('app.name')}</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/40 rounded-3xl shadow-2xl shadow-black/60 p-8">
          {view === 'login-identifier' && (
            <LoginIdentifierStep
              t={t}
              onNext={handleIdentifierNext}
              onSwitchToRegister={() => switchView('register')}
            />
          )}

          {view === 'login-password' && identifierData && (
            <LoginPasswordStep
              t={t}
              identifierData={identifierData}
              onBack={handleBack}
              onLogin={login}
            />
          )}

          {view === 'register' && (
            <RegisterForm
              t={t}
              onSwitchToLogin={() => switchView('login-identifier')}
              onRegister={register}
            />
          )}
        </div>

        <TipFooter t={t} seed={tipSeed} />
      </div>
    </div>
  );
}
