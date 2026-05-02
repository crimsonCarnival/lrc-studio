import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, spotify as spotifyApi, setAccessToken, clearAccessToken } from '../api';

const ACCESS_TOKEN_KEY = 'lrc-syncer-access-token';
const REFRESH_TOKEN_KEY = 'lrc-syncer-refresh-token';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const doLogout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // Clear project data so stale projects don't persist across accounts
    localStorage.removeItem('lrc-syncer-project');
    localStorage.removeItem('lrc-syncer-shared-project');
    localStorage.removeItem('lrc-syncer-active-project-id');
    clearAccessToken();
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // Schedule a token refresh before the access token expires (default: 14 min for 15 min expiry)
  const scheduleRefresh = useCallback((expiresIn = 14 * 60 * 1000) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!rt) return;
      try {
        const result = await auth.refresh(rt);
        localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
        if (result.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
        }
        setAccessToken(result.accessToken);
        scheduleRefresh();
      } catch {
        // Refresh failed — token expired, force logout
        doLogout();
      }
    }, expiresIn);
  }, [doLogout]);

  // Restore project on mount — guarded against StrictMode double-fire
  const restoringRef = useRef(false);
  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;

    const restore = async () => {
      const at = localStorage.getItem(ACCESS_TOKEN_KEY);
      const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!at && !rt) {
        setLoading(false);
        return;
      }

      if (at) {
        setAccessToken(at);
        try {
          const result = await auth.me();
          setUser(result.user);
          scheduleRefresh();
          setLoading(false);
          return;
        } catch (err) {
          // Access token expired or user deleted — clear it so refresh can try
          clearAccessToken();
          if (err?.status === 404) {
            // User no longer exists — clear all tokens
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            setLoading(false);
            return;
          }
        }
      }

      if (rt) {
        try {
          const result = await auth.refresh(rt);
          localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
          if (result.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
          }
          setAccessToken(result.accessToken);
          const me = await auth.me();
          setUser(me.user);
          scheduleRefresh();
        } catch {
          // Both tokens invalid
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          clearAccessToken();
        }
      }
      setLoading(false);
    };

    restore();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(async ({ identifier, password }) => {
    const result = await auth.login({ identifier, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
    scheduleRefresh();

    const cloneProjectId = localStorage.getItem('cloneAfterAuth');
    if (cloneProjectId) {
      localStorage.removeItem('cloneAfterAuth');
      window.location.href = `/?clone=${cloneProjectId}`;
    }

    return result;
  }, [scheduleRefresh]);

  const register = useCallback(async ({ username, email, password }) => {
    const result = await auth.register({ username, email, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
    scheduleRefresh();

    // Handle post-auth continuation (e.g., after cloning a project)
    const cloneProjectId = localStorage.getItem('cloneAfterAuth');
    if (cloneProjectId) {
      localStorage.removeItem('cloneAfterAuth');
      window.location.href = `/?clone=${cloneProjectId}`;
    }

    return result;
  }, [scheduleRefresh]);

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

  return { user, setUser, loading, login, register, logout: doLogout, connectSpotify, disconnectSpotify };
}
