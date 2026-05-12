import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Checkbox } from '@ui/checkbox';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Lightbulb, Loader2, Globe, Check, Music2, FileText, Zap, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverItem, PopoverTrigger } from '@ui/popover';
import RegistrationBlockedModal from './RegistrationBlockedModal';
import { translateAuthError } from '@/utils/authErrors';
import { auth } from '@/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useThemeSync } from '@/hooks/useThemeSync';
import { FloatingInput } from '@ui/floating-input';

const LANG_NAMES = {
  en: { en: 'English',  es: 'Inglés',    ja: '英語'        },
  es: { en: 'Spanish',  es: 'Español',   ja: 'スペイン語'  },
  ja: { en: 'Japanese', es: 'Japonés',   ja: '日本語'      },
};

const LANGUAGES = [
  { code: 'en', short: 'EN' },
  { code: 'es', short: 'ES' },
  { code: 'ja', short: 'JA' },
];

function getLangLabel(code, currentLang) {
  const native = LANG_NAMES[code]?.[code] || code;
  const translated = LANG_NAMES[code]?.[currentLang];
  if (!translated || translated === native) return native;
  return `${native} (${translated})`;
}

function LangSwitcher({ i18n }) {
  const currentCode = (i18n?.language || 'en').split('-')[0];
  const currentShort = currentCode.toUpperCase();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 h-8 px-2.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 rounded-xl transition-colors text-[11px] font-bold"
          title="Language"
        >
          <Globe className="w-3.5 h-3.5" />
          {currentShort}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" sideOffset={6}>
        {LANGUAGES.map(({ code, short }) => {
          const label = getLangLabel(code, currentCode);
          const active = currentCode === code;
          return (
            <PopoverItem
              key={code}
              onClick={() => i18n?.changeLanguage(code)}
              className={`flex items-center gap-2.5 cursor-pointer text-sm py-2 ${active ? 'text-primary' : ''}`}
            >
              <span className="text-[10px] font-bold text-zinc-500 w-6 shrink-0">{short}</span>
              <span className="flex-1 text-left">{label}</span>
              <Check className={`size-3 shrink-0 ${active ? 'text-primary' : 'invisible'}`} />
            </PopoverItem>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

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

function RedirectMessage({ from, t }) {
  const [visible, setVisible] = useState(!!from);

  useEffect(() => {
    if (from) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [from]);

  if (!from || !visible) return null;
  
  let message = '';
  let variant = 'info';
  
  switch(from) {
    case 'logout':
      message = t('auth.message.logout', 'You have been signed out successfully.');
      break;
    case 'session-expiration':
      message = t('auth.message.sessionExpired', 'Your session has expired. Please sign in again.');
      variant = 'warning';
      break;
    case 'banned':
      message = t('auth.message.banned', 'Your account has been restricted. Please contact support.');
      variant = 'danger';
      break;
    case 'unauthorized':
      message = t('auth.message.unauthorized', 'Please sign in to access this page.');
      break;
    default:
      return null;
  }
  
  return (
    <div className={`mb-6 p-3 rounded-xl text-xs font-medium flex items-center gap-3 border transition-all duration-500 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
    } ${
      variant === 'warning' ? 'bg-warning/10 border-warning/20 text-warning' :
      variant === 'danger' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
      'bg-primary/10 border-primary/20 text-primary'
    }`}>
      {variant === 'warning' ? <Lightbulb className="w-4 h-4 shrink-0" /> : <Music2 className="w-4 h-4 shrink-0" />}
      <div className="flex-1">{message}</div>
      <button 
        onClick={() => setVisible(false)}
        className="p-1 hover:bg-white/5 rounded-md transition-colors opacity-60 hover:opacity-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ContextBanner({ redirect, t }) {
  if (!redirect) return null;
  
  // Decode and clean up the redirect path for display
  let displayPath = '';
  try {
    const decoded = decodeURIComponent(redirect);
    const url = new URL(decoded, window.location.origin);
    displayPath = url.pathname;
    // Special cases for common paths
    if (displayPath.startsWith('/project/')) {
      const id = displayPath.split('/').pop();
      displayPath = id === 'new' ? t('auth.context.newProject', 'New Project') : t('auth.context.project', 'Project');
    } else if (displayPath === '/library') {
      displayPath = t('auth.context.library', 'Your Library');
    } else if (displayPath === '/home') {
      displayPath = t('auth.context.home', 'Home');
    }
  } catch {
    displayPath = redirect.split('?')[0];
  }

  return (
    <div className="mb-6 flex items-center gap-2 px-3 py-2 bg-zinc-800/40 border border-zinc-700/30 rounded-xl animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
        <ArrowRight className="w-3 h-3 text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 leading-none">
          {t('auth.context.continuingTo', 'Continuing to')}
        </p>
        <p className="text-xs font-semibold text-zinc-300 truncate mt-0.5">
          {displayPath}
        </p>
      </div>
    </div>
  );
}

// ─── Login Step 1 — Identifier ─────────────────────────────────────────────

function LoginIdentifierStep({ t, onNext, onSwitchToRegister, from, redirect, navigate }) {
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
      <RedirectMessage from={from} t={t} />
      <ContextBanner redirect={redirect} t={t} />
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

        <div className="flex flex-col gap-4 mt-2">
          <p className="text-xs text-zinc-500 text-center">
            {t('auth.noAccount')}{' '}
            <button type="button" onClick={onSwitchToRegister} className="text-primary hover:text-primary-dim hover:underline font-semibold transition-colors">
              {t('auth.register')}
            </button>
          </p>

          <div className="flex items-center gap-3 px-8">
            <div className="flex-1 h-px bg-zinc-800/40" />
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] leading-none">{t('common.or', 'OR')}</span>
            <div className="flex-1 h-px bg-zinc-800/40" />
          </div>

          <button 
            type="button" 
            onClick={() => navigate('/project/new')} 
            className="group flex items-center justify-center gap-2 py-1 text-xs font-semibold text-zinc-500 hover:text-primary transition-all duration-300"
          >
            <Zap className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:fill-primary/20 transition-all" />
            {t('auth.guestMode', 'Continue as Guest')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Login Step 2 — Password ───────────────────────────────────────────────

function LoginPasswordStep({ t, identifierData, onBack, onLogin, onSuccess }) {
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

function RegisterForm({ t, onSwitchToLogin, onRegister, onSuccess, redirect, navigate }) {
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
      onSuccess?.();
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
      <ContextBanner redirect={redirect} t={t} />
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

        <div className="flex flex-col gap-4 mt-4">
          <p className="text-xs text-zinc-500 text-center">
            {t('auth.hasAccount')}{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-primary hover:text-primary-dim hover:underline font-semibold transition-colors">
              {t('auth.login')}
            </button>
          </p>

          <div className="flex items-center gap-3 px-8">
            <div className="flex-1 h-px bg-zinc-800/40" />
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] leading-none">{t('common.or', 'OR')}</span>
            <div className="flex-1 h-px bg-zinc-800/40" />
          </div>

          <button 
            type="button" 
            onClick={() => navigate('/project/new')} 
            className="group flex items-center justify-center gap-2 py-1 text-xs font-semibold text-zinc-500 hover:text-primary transition-all duration-300"
          >
            <Zap className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:fill-primary/20 transition-all" />
            {t('auth.guestMode', 'Continue as Guest')}
          </button>
        </div>
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
  const { t, i18n } = useTranslation();
  const { login, register } = useAuthContext();
  const [searchParams] = useSearchParams();
  const { mode } = useParams();
  const navigate = useNavigate();
  useThemeSync();

  const action = mode || searchParams.get('action') || 'signin';
  const redirect = searchParams.get('redirect') || '';
  usePageTitle();

  const [view, setView] = useState(() => {
    return (action === 'signup' || action === 'register') ? 'register' : 'login-identifier';
  });

  const [identifierData, setIdentifierData] = useState(null);
  const [tipSeed] = useState(() => Math.floor(Math.random() * 1000));

  // 1. Force pretty URLs if legacy query params are used
  useEffect(() => {
    if (!mode && searchParams.has('action')) {
      const legacyAction = searchParams.get('action');
      const targetAction = (legacyAction === 'signup' || legacyAction === 'register') ? 'signup' : 'signin';
      const redirectParam = searchParams.get('redirect');
      const fromParam = searchParams.get('from');
      
      const newParams = new URLSearchParams();
      if (redirectParam) newParams.set('redirect', redirectParam);
      if (fromParam) newParams.set('from', fromParam);
      
      const suffix = newParams.toString() ? `?${newParams.toString()}` : '';
      navigate(`/auth/${targetAction}${suffix}`, { replace: true });
    }
  }, [mode, searchParams, navigate]);

  // 2. Sync view state when action changes (e.g. browser back button or direct link)
  useEffect(() => {
    if (action === 'signup' || action === 'register') {
      setView('register');
    } else {
      setView(prev => prev === 'register' ? 'login-identifier' : prev);
    }
  }, [action]);

  // 2. Sync URL when view state changes manually (e.g. switchView calls)
  useEffect(() => {
    const targetAction = view === 'register' ? 'signup' : 'signin';
    const isMatched = action === targetAction || (action === 'sign-in' && targetAction === 'signin');
    
    if (!isMatched) {
      const currentRedirect = searchParams.get('redirect');
      const redirectSuffix = currentRedirect ? `?redirect=${encodeURIComponent(currentRedirect)}` : '';
      navigate(`/auth/${targetAction}${redirectSuffix}`, { replace: true });
    }
  }, [view, action, navigate, searchParams]);

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
    const targetAction = newView === 'register' ? 'signup' : 'signin';
    const currentRedirect = searchParams.get('redirect');
    const redirectSuffix = currentRedirect ? `?redirect=${encodeURIComponent(currentRedirect)}` : '';
    navigate(`/auth/${targetAction}${redirectSuffix}`, { replace: true });
  }, [navigate, searchParams]);

  const handleAuthSuccess = useCallback(() => {
    const redirectTo = searchParams.get('redirect');
    if (redirectTo) {
      // Use window.location.href (not navigate) so the target page gets a full
      // reload and its own useEffect hooks fire cleanly — important for clone=1.
      window.location.href = redirectTo;
    }
    // If no redirect, do nothing — the auth context will handle routing to home.
  }, [searchParams]);

  const features = [
    { icon: Music2, key: 'featureSync', descKey: 'featureSyncDesc' },
    { icon: FileText, key: 'featureExport', descKey: 'featureExportDesc' },
    { icon: Zap, key: 'featureConnect', descKey: 'featureConnectDesc' },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden font-sans">
      <Background />

      {/* Language switcher — top right */}
      <div className="fixed top-4 right-4 z-raised">
        <LangSwitcher i18n={i18n} />
      </div>

      {/* ── Left branding panel (hidden on mobile) ─────────────────────── */}
      <div className="hidden lg:flex flex-col w-[420px] xl:w-[460px] shrink-0 relative border-r border-zinc-800/50 px-10 py-10">
        {/* Subtle left-side glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-accent-purple/3 pointer-events-none" />

        {/* Logo + wordmark */}
        <div className="relative flex items-center gap-3 mb-auto">
          <div className="w-9 h-9 shrink-0">
            <img
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png"
              alt="LRC Studio"
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(29,185,84,0.35)]"
            />
          </div>
          <span className="text-sm font-bold text-zinc-100 tracking-tight font-heading">{t('app.name')}</span>
        </div>

        {/* Hero content */}
        <div className="relative flex-1 flex flex-col justify-center py-20">
          <motion.h2 
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl xl:text-5xl font-bold text-zinc-100 leading-tight tracking-tight font-heading mb-10"
          >
            {t('auth.tagline', 'Sync lyrics to music, your way')}
          </motion.h2>

          <motion.ul 
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
            }}
            className="flex flex-col gap-6"
          >
            {features.map(({ icon: Icon, key, descKey }) => (
              <motion.li 
                key={key} 
                variants={{
                  hidden: { opacity: 0, x: -30 },
                  visible: { opacity: 1, x: 0 }
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-primary/5">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-zinc-100 tracking-tight">{t(`auth.${key}`)}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-[280px]">{t(`auth.${descKey}`)}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Footer */}
        <p className="relative text-[10px] text-zinc-700 mt-auto">
          &copy; {new Date().getFullYear()} LRC Studio
        </p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-20 relative">

        {/* Mobile-only logo */}
        <div className="flex flex-col items-center mb-10 lg:hidden">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 mb-3"
          >
            <img
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png"
              alt="LRC Studio"
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(29,185,84,0.3)]"
            />
          </motion.div>
          <p className="text-base font-bold text-zinc-100 font-heading">{t('app.name')}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{t('auth.tagline')}</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-[400px]"
        >
          {/* Card */}
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/40 rounded-3xl shadow-2xl shadow-black/60 p-7 sm:p-8">
            {view === 'login-identifier' && (
              <LoginIdentifierStep
                t={t}
                onNext={handleIdentifierNext}
                onSwitchToRegister={() => switchView('register')}
                from={searchParams.get('from')}
                redirect={redirect}
                navigate={navigate}
              />
            )}

            {view === 'login-password' && identifierData && (
              <LoginPasswordStep
                t={t}
                identifierData={identifierData}
                onBack={handleBack}
                onLogin={login}
                onSuccess={handleAuthSuccess}
              />
            )}

            {view === 'register' && (
              <RegisterForm
                t={t}
                onSwitchToLogin={() => switchView('login-identifier')}
                onRegister={register}
                onSuccess={handleAuthSuccess}
                redirect={redirect}
                navigate={navigate}
              />
            )}
          </div>

          <TipFooter t={t} seed={tipSeed} />

          {/* reCAPTCHA Notice */}
          <div className="mt-6 px-4 text-center animate-fade-in" style={{ animationDelay: '500ms' }}>
            <p className="text-[10px] leading-relaxed text-zinc-600">
              <Trans
                i18nKey="auth.recaptchaNotice"
                components={[
                  <a key="0" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors" />,
                  <a key="1" href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors" />
                ]}
              />
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
