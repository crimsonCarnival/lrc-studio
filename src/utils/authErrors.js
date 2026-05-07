/**
 * Maps a backend error code to the correct i18n key and translates it.
 *
 * Backend returns: { error: <code>, code: <code> }
 * This utility: t(`auth.errors.<code>`) → falls back to a generic key if unknown.
 *
 * @param {Function} t  — i18next `t` function
 * @param {object}   err — the thrown error object from api.client (err.body.code or err.status)
 * @param {'login'|'register'|'generic'} context — which fallback to use when the code is unknown
 * @param {string} [value] — the input value (e.g. identifier) to specialize error messages
 * @returns {string} translated error message
 */
export function translateAuthError(t, err, context = 'generic', value = '') {
  const code = err?.body?.code || err?.code;

  if (code) {
    let key = `auth.errors.${code}`;

    // Specialize identifier_not_found based on input format
    if (code === 'identifier_not_found' && value) {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      key = isEmail ? 'auth.errors.email_not_found' : 'auth.errors.username_not_found';
    }

    const translated = t(key);
    // i18next returns the key string itself if translation not found
    if (translated !== key) return translated;
  }

  // Status-based fallbacks
  const status = err?.status ?? err?.body?.status;
  if (status === 429) return t('auth.tooManyAttempts');
  if (status === 409) return t('auth.errors.username_taken');
  if (status === 401) return t('auth.errors.invalid_credentials');
  if (status === 403) return t('auth.errors.account_banned');
  if (status === 400) return t('auth.validationError');

  // Context-based final fallback
  if (context === 'login') return t('auth.loginError');
  if (context === 'register') return t('auth.registerError');
  return t('auth.errors.generic');
}
