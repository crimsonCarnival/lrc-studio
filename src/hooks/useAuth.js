import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, spotify as spotifyApi, setAuthFlag } from '@/api';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import toast from 'react-hot-toast';
import { authEvents } from '../utils/authEvents.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const doLogout = useCallback(async () => {
    try {
      await auth.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    // Clear project data so stale projects don't persist across accounts
    localStorage.removeItem('lrc-syncer-project');
    localStorage.removeItem('lrc-syncer-shared-project');
    localStorage.removeItem('lrc-syncer-active-project-id');
    setAuthFlag(false);
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // Schedule a token refresh before the access token expires (default: 14 min for 15 min expiry)
  const scheduleRefresh = useCallback((expiresIn = 14 * 60 * 1000) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        await auth.refresh();
        scheduleRefresh();
      } catch {
        // Refresh failed — session fully expired, force logout with feedback
        await doLogout();
        toast.error('Your session has expired. Please sign in again.', {
          id: 'session-expired',
          duration: 6000,
        });
      }
    }, expiresIn);
  }, [doLogout]);

  // Restore project on mount — guarded against StrictMode double-fire
  const restoringRef = useRef(false);
  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;

    const restore = async () => {
      try {
        const user = await auth.me();
        setAuthFlag(true);
        setUser(user);
        scheduleRefresh();
      } catch (err) {
        if (err?.status === 401) {
          // Access token might be expired, try refreshing
          try {
            await auth.refresh();
            const user = await auth.me();
            setAuthFlag(true);
            setUser(user);
            scheduleRefresh();
          } catch {
            // Both tokens invalid or missing
            setAuthFlag(false);
            setUser(null);
          }
        } else {
          setAuthFlag(false);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    restore();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // ——— Global token-expiry handler ———
  const isRefreshingRef = useRef(false);
  useEffect(() => {
    const unsub = authEvents.on('token:expired', async () => {
      if (isRefreshingRef.current) return; // de-duplicate concurrent events
      isRefreshingRef.current = true;
      try {
        await auth.refresh();
        scheduleRefresh();
      } catch {
        // Both tokens are dead — force logout
        await doLogout();
        toast.error('Your session has expired. Please sign in again.', {
          id: 'session-expired',
          duration: 6000,
        });
        window.location.href = '/auth?action=signin&from=session-expiration';
      } finally {
        isRefreshingRef.current = false;
      }
    });
    return unsub;
  }, [doLogout, scheduleRefresh]);

  const login = useCallback(async ({ identifier, password }) => {
    let recaptchaToken = undefined;
    if (executeRecaptcha) {
      recaptchaToken = await executeRecaptcha('login');
    }
    const result = await auth.login({ identifier, password, recaptchaToken });
    // Cookies are automatically set by the server. Just update user state.
    setAuthFlag(true);
    setUser(result.user);
    scheduleRefresh();

    const cloneProjectId = localStorage.getItem('cloneAfterAuth');
    if (cloneProjectId) {
      localStorage.removeItem('cloneAfterAuth');
      window.location.href = `/share/${cloneProjectId}?clone=1`;
    }

    return result;
  }, [scheduleRefresh, executeRecaptcha]);

  const register = useCallback(async ({ username, email, password }) => {
    let recaptchaToken = undefined;
    if (executeRecaptcha) {
      recaptchaToken = await executeRecaptcha('register');
    }
    const result = await auth.register({ username, email, password, recaptchaToken });
    // Cookies are automatically set by the server. Just update user state.
    setAuthFlag(true);
    setUser(result.user);
    scheduleRefresh();

    // Handle post-auth continuation (e.g., after cloning a project)
    const cloneProjectId = localStorage.getItem('cloneAfterAuth');
    if (cloneProjectId) {
      localStorage.removeItem('cloneAfterAuth');
      window.location.href = `/share/${cloneProjectId}?clone=1`;
    }

    return result;
  }, [scheduleRefresh, executeRecaptcha]);

  // ——— Spotify connect / disconnect ———

  const connectSpotify = useCallback(async () => {
    const { url } = await spotifyApi.getAuthUrl();
    // Open Spotify auth in a popup — backend callback returns HTML that posts message back
    const width = 500, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(url, 'spotify-auth', `width=${width},height=${height},left=${left},top=${top}`);

    return new Promise((resolve, reject) => {
      const onMessage = async (event) => {
        let data = event.data;
        if (typeof data === 'string') try { data = JSON.parse(data); } catch { return; }
        if (data?.type !== 'spotify-callback') return;
        window.removeEventListener('message', onMessage);
        clearInterval(interval);

        if (!data.success) { reject(new Error(data.error || 'Spotify connection failed')); return; }

        // Refresh user to get updated spotify status
        const me = await auth.me();
        setUser(me.user);
        resolve(me.user);
      };
      window.addEventListener('message', onMessage);
      // Fallback: poll for popup close
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          window.removeEventListener('message', onMessage);
        }
      }, 500);
    });
  }, []);

  const disconnectSpotify = useCallback(async () => {
    await spotifyApi.disconnect();
    const me = await auth.me();
    setUser(me.user);
  }, []);

  const clearUnbanMessage = useCallback(async () => {
    await auth.clearUnbanMessage();
    setUser(prev => prev ? { ...prev, showUnbanMessage: false } : null);
  }, []);

  return { user, setUser, loading, login, register, logout: doLogout, connectSpotify, disconnectSpotify, clearUnbanMessage };
}
