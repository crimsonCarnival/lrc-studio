import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { X } from 'lucide-react';
import { Spinner } from '@ui/skeleton';
import { translateAuthError } from '@/utils/authErrors';

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-400 font-medium mt-0.5">{message}</p>;
}

export default function AuthModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { login, register } = useAuthContext();
  const [tab, setTab] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const resetFields = () => {
    setIdentifier('');
    setLoginPassword('');
    setUsername('');
    setEmail('');
    setRegPassword('');
    setError('');
    setFieldErrors({});
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setError('');
    setFieldErrors({});
  };

  const validateLogin = () => {
    const errors = {};
    if (!identifier.trim()) errors.identifier = t('auth.validation.fieldRequired');
    if (!loginPassword) errors.loginPassword = t('auth.validation.fieldRequired');
    else if (loginPassword.length < 8) errors.loginPassword = t('auth.validation.passwordMinLength');
    return errors;
  };

  const validateRegister = () => {
    const errors = {};
    if (username && username.length < 3) errors.username = t('auth.validation.usernameMinLength');
    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) errors.username = t('auth.validation.usernamePattern');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t('auth.validation.emailInvalid');
    if (!username && !email) errors.username = t('auth.validation.fieldRequired');
    if (!regPassword) errors.regPassword = t('auth.validation.fieldRequired');
    else if (regPassword.length < 8) errors.regPassword = t('auth.validation.passwordMinLength');
    return errors;
  };

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const errors = validateLogin();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setError('');
    setLoading(true);
    try {
      await login({ identifier, password: loginPassword });
      resetFields();
      onClose();
    } catch (err) {
      setError(translateAuthError(t, err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const errors = validateRegister();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setError('');
    setLoading(true);
    try {
      await register({
        username: username || undefined,
        email: email || undefined,
        password: regPassword,
      });
      resetFields();
      onClose();
    } catch (err) {
      setError(translateAuthError(t, err, 'register'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-modal-backdrop animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-elevated pointer-events-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Tabs */}
          <div className="flex border-b border-zinc-700/60 px-6 pt-5">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                tab === 'login'
                  ? 'text-primary border-primary'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${
                tab === 'register'
                  ? 'text-primary border-primary'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {t('auth.register')}
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-medium">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="auth-identifier" className="text-xs font-semibold text-zinc-300">
                    {t('auth.usernameOrEmail')}
                  </Label>
                  <Input
                    id="auth-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setFieldErrors(p => ({ ...p, identifier: '' })); }}
                    autoFocus
                    autoComplete="username"
                    className={`bg-zinc-800/80 border-zinc-700/60 ${fieldErrors.identifier ? 'border-red-500/60' : ''}`}
                  />
                  <FieldError message={fieldErrors.identifier} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="auth-password" className="text-xs font-semibold text-zinc-300">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="auth-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setFieldErrors(p => ({ ...p, loginPassword: '' })); }}
                    autoComplete="current-password"
                    className={`bg-zinc-800/80 border-zinc-700/60 ${fieldErrors.loginPassword ? 'border-red-500/60' : ''}`}
                  />
                  <FieldError message={fieldErrors.loginPassword} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10 mt-1"
                >
                  {loading ? <Spinner size={18} /> : t('auth.loginAction')}
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  {t('auth.noAccount')}{' '}
                  <button type="button" onClick={() => switchTab('register')} className="text-primary hover:underline font-medium">
                    {t('auth.register')}
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="auth-username" className="text-xs font-semibold text-zinc-300">
                    {t('auth.username')}
                  </Label>
                  <Input
                    id="auth-username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: '' })); }}
                    autoComplete="username"
                    maxLength={30}
                    className={`bg-zinc-800/80 border-zinc-700/60 ${fieldErrors.username ? 'border-red-500/60' : ''}`}
                  />
                  <FieldError message={fieldErrors.username} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="auth-email" className="text-xs font-semibold text-zinc-300">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="auth-email"
                    type="text"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                    autoComplete="email"
                    className={`bg-zinc-800/80 border-zinc-700/60 ${fieldErrors.email ? 'border-red-500/60' : ''}`}
                  />
                  <FieldError message={fieldErrors.email} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="auth-reg-password" className="text-xs font-semibold text-zinc-300">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="auth-reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => { setRegPassword(e.target.value); setFieldErrors(p => ({ ...p, regPassword: '' })); }}
                    autoComplete="new-password"
                    className={`bg-zinc-800/80 border-zinc-700/60 ${fieldErrors.regPassword ? 'border-red-500/60' : ''}`}
                  />
                  <FieldError message={fieldErrors.regPassword} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10 mt-1"
                >
                  {loading ? <Spinner size={18} /> : t('auth.registerAction')}
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  {t('auth.hasAccount')}{' '}
                  <button type="button" onClick={() => switchTab('login')} className="text-primary hover:underline font-medium">
                    {t('auth.login')}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
