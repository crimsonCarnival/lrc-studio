import { useState, useEffect, useCallback } from 'react';
import { LazyMotion, domAnimation, m as M } from 'framer-motion';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { toast } from 'react-hot-toast';
import { Music2, FileText, Zap } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useThemeSync } from '@/hooks/useThemeSync';
import LoginIdentifierStep from './LoginIdentifierStep';
import LoginPasswordStep from './LoginPasswordStep';
import SignUpForm from './SignUpForm';
import ForgotPasswordTab from './ForgotPasswordTab.jsx';
import { Background, LangSwitcher } from './auth-shared';

// ─── Main AuthPage ──────────────────────────────────────────────────────────

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { login, register, loginWithGoogle } = useAuthContext();
  const [searchParams] = useSearchParams();
  const { mode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  useThemeSync();

  const action = mode || searchParams.get('action') || 'signin';
  const redirect = searchParams.get('redirect') || '';
  usePageTitle();

  const [view, setView] = useState(() => {
    if (action === 'forgot-password') return 'forgot-password';
    return (action === 'signup' || action === 'register') ? 'register' : 'login-identifier';
  });

  const [identifierData, setIdentifierData] = useState(null);
  // 1. Force pretty URLs if legacy query params are used
  useEffect(() => {
    if (!mode && searchParams.has('action')) {
      const legacyAction = searchParams.get('action');
      let targetAction = 'signin';
      if (legacyAction === 'signup' || legacyAction === 'register') {
        targetAction = 'signup';
      } else if (legacyAction === 'forgot-password') {
        targetAction = 'forgot-password';
      }
      const redirectParam = searchParams.get('redirect');
      const fromParam = searchParams.get('from');

      const newParams = new URLSearchParams();
      if (redirectParam) newParams.set('redirect', redirectParam);
      if (fromParam) newParams.set('from', fromParam);

      const suffix = newParams.toString() ? `?${newParams.toString()}` : '';
      navigate(`/auth/${targetAction}${suffix}`, { replace: true });
    }
  }, [mode, searchParams, navigate]);

  const [prevLocationSearch, setPrevLocationSearch] = useState(location.search);
  if (location.search !== prevLocationSearch) {
    setPrevLocationSearch(location.search);
    const params = new URLSearchParams(location.search);
    const actionParam = params.get('action');
    if (actionParam === 'forgot-password') {
      setView('forgot-password');
    }
  }

  // 2. Sync view state when action changes (e.g. browser back button or direct link)
  const [prevAction, setPrevAction] = useState(action);
  if (action !== prevAction) {
    setPrevAction(action);
    if (action === 'signup' || action === 'register') {
      setView('register');
    } else if (action === 'forgot-password') {
      setView('forgot-password');
    } else {
      setView(prev => prev === 'register' || prev === 'forgot-password' ? 'login-identifier' : prev);
    }
  }

  // 2. Sync URL when view state changes manually (e.g. switchView calls)
  useEffect(() => {
    let targetAction = 'signin';
    if (view === 'register') {
      targetAction = 'signup';
    } else if (view === 'forgot-password') {
      targetAction = 'forgot-password';
    }
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
    let targetAction = 'signin';
    if (newView === 'register') {
      targetAction = 'signup';
    } else if (newView === 'forgot-password') {
      targetAction = 'forgot-password';
    }
    const currentRedirect = searchParams.get('redirect');
    const redirectSuffix = currentRedirect ? `?redirect=${encodeURIComponent(currentRedirect)}` : '';
    navigate(`/auth/${targetAction}${redirectSuffix}`, { replace: true });
  }, [navigate, searchParams]);

  const handleAuthSuccess = useCallback(() => {
    const redirectTo = searchParams.get('redirect');
    if (redirectTo) {
      // Use smooth SPA navigation for local redirects to keep the claiming flow robust.
      // Falls back to window.location.href for any external/absolute redirection URLs.
      if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
        navigate(redirectTo, { replace: true });
      } else {
        window.location.href = redirectTo;
      }
    } else {
      // If no explicit redirect, go to home
      navigate('/home');
    }
  }, [searchParams, navigate]);

  const features = [
    { icon: Music2, key: 'featureSync', descKey: 'featureSyncDesc' },
    { icon: FileText, key: 'featureExport', descKey: 'featureExportDesc' },
    { icon: Zap, key: 'featureConnect', descKey: 'featureConnectDesc' },
  ];

  return (
    <LazyMotion features={domAnimation}>
      <div className="size-screen flex relative overflow-hidden font-sans">
      <Background />

      {/* Language switcher — top right */}
      <div className="fixed top-4 right-4 z-raised">
        <LangSwitcher i18n={i18n} />
      </div>

      {/* ── Left branding panel (hidden on mobile) ─────────────────────── */}
      <div className="hidden lg:flex flex-col w-[420px] xl:w-[460px] shrink-0 relative border-r border-zinc-800/50 p-8 h-screen overflow-hidden">
        {/* Subtle left-side glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-accent-purple/3 pointer-events-none" />

        {/* Hero content */}
        <div className="relative flex-1 flex flex-col justify-center">
          <M.h2
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl xl:text-4xl font-semibold text-zinc-100 leading-tight tracking-tight font-heading mb-8"
          >
            {t('auth.tagline', 'Sync lyrics to music, your way')}
          </M.h2>

          <M.ul
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
            }}
            className="flex flex-col gap-4"
          >
            {features.map(({ icon: Icon, key, descKey }) => (
              <M.li
                key={key}
                variants={{
                  hidden: { opacity: 0, x: -30 },
                  visible: { opacity: 1, x: 0 }
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex items-start gap-3"
              >
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-primary/5">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100 tracking-tight">{t(`auth.${key}`)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed max-w-[260px]">{t(`auth.${descKey}`)}</p>
                </div>
              </M.li>
            ))}
          </M.ul>
        </div>

        {/* Footer */}
        <p className="relative text-[9px] text-zinc-700 mt-8 shrink-0">
          &copy; {new Date().getFullYear()} LRC Studio
        </p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-4 h-screen overflow-hidden relative">

        {/* Logo above form */}
        <M.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-4 shrink-0"
        >
          <div className="size-8 mb-1.5">
            <img
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png"
              alt="LRC Studio"
              className="size-full object-contain drop-shadow-[0_0_12px_rgba(29,185,84,0.3)]"
            />
          </div>
          <p className="text-xs font-bold text-zinc-100 font-heading tracking-tight">{t('app.name')}</p>
        </M.div>

        <M.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-[400px] flex-shrink"
        >
          {/* Card */}
          <div className="bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] shadow-card p-7 sm:p-8 relative">
            {view === 'login-identifier' && (
              <LoginIdentifierStep
                t={t}
                onNext={handleIdentifierNext}
                onSwitchToRegister={() => switchView('register')}
                onGoogleLogin={async () => {
                  try {
                    await loginWithGoogle();
                    handleAuthSuccess();
                  } catch {
                    toast.error(t('auth.errors.googleLoginFailed'));
                  }
                }}
                from={searchParams.get('from')}
                redirect={redirect}
              />
            )}

            {view === 'login-password' && identifierData && (
              <LoginPasswordStep
                t={t}
                identifierData={identifierData}
                onBack={handleBack}
                onLogin={login}
                onGoogleLogin={async () => {
                  try {
                    await loginWithGoogle();
                    handleAuthSuccess();
                  } catch {
                    toast.error(t('auth.errors.googleLoginFailed'));
                  }
                }}
                onSuccess={handleAuthSuccess}
                onSwitchToForgotPassword={() => switchView('forgot-password')}
              />
            )}

            {view === 'register' && (
              <SignUpForm
                t={t}
                onSwitchToLogin={() => switchView('login-identifier')}
                onRegister={register}
                onGoogleLogin={async () => {
                  try {
                    await loginWithGoogle();
                    handleAuthSuccess();
                  } catch {
                    toast.error(t('auth.errors.googleLoginFailed'));
                  }
                }}
                onSuccess={handleAuthSuccess}
                redirect={redirect}
              />
            )}

            {view === 'forgot-password' && (
              <ForgotPasswordTab onBackToLogin={() => switchView('login-identifier')} />
            )}
          </div>

          {/* reCAPTCHA Notice */}
          <div className="mt-3 px-4 text-center animate-fade-in text-center shrink-0" style={{ animationDelay: '500ms' }}>
            <p className="text-[9px] leading-relaxed text-zinc-600">
              <Trans
                i18nKey="auth.recaptchaNotice"
                components={[
                  <a key="0" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors" />,
                  <a key="1" href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors" />
                ]}
              />
            </p>
          </div>
        </M.div>
      </div>
    </div>
    </LazyMotion>
  );
}
