import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthContext } from '@/features/auth/useAuthContext';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { getPendingProject, clearPendingProject } from '@/features/editor/services/guest-project-db';
import { request } from '@/app/api.client';

const BACKOFF_INTERVALS_MS = [2000, 4000, 8000, 16000, 32000];
const STEADY_INTERVAL_MS = 30000;

function getBackoffDelay(attempt) {
  return attempt < BACKOFF_INTERVALS_MS.length
    ? BACKOFF_INTERVALS_MS[attempt]
    : STEADY_INTERVAL_MS;
}

export default function GuestProjectSaveGate() {
  const { user } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const isActive =
    !!user &&
    location.pathname === '/project/local' &&
    new URLSearchParams(location.search).get('fromGuest') === '1';

  const attemptRef = useRef(0);
  const [displayAttempt, setDisplayAttempt] = useState(0);

  // Stable refs so the effect closure always calls the latest versions without
  // listing them as dependencies (which would re-fire the effect on every render).
  const navigateRef = useRef(navigate);
  const executeRecaptchaRef = useRef(executeRecaptcha);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { executeRecaptchaRef.current = executeRecaptcha; }, [executeRecaptcha]);

  useEffect(() => {
    if (!isActive) return;

    // Per-invocation cancellation flag captured in the closure.
    // Each effect invocation gets its own `cancelled` variable, so the cleanup
    // from run #1 cannot interfere with run #2 (which is what React StrictMode
    // does in development: mount → cleanup → mount).
    let cancelled = false;
    attemptRef.current = 0;

    const run = async () => {
      const record = await getPendingProject();
      if (cancelled) return;
      setDisplayAttempt(0);

      if (!record) {
        await clearPendingProject();
        toast.error('Your draft expired. Your edits are still in the editor — save again to keep them.');
        navigateRef.current('/', { replace: true });
        return;
      }

      const attempt = async () => {
        if (cancelled) return;

        try {
          const recaptchaToken = executeRecaptchaRef.current
            ? await executeRecaptchaRef.current('create_project').catch(() => undefined)
            : undefined;

          if (cancelled) return;

          const { savedAt: _savedAt, ...payload } = record;
          const result = await request('/projects', {
            method: 'POST',
            body: JSON.stringify({ ...payload, recaptchaToken }),
          });

          if (cancelled) return;
          await clearPendingProject();
          navigateRef.current(`/project/${result.projectId}`, { replace: true });
        } catch {
          if (cancelled) return;
          const delay = getBackoffDelay(attemptRef.current);
          attemptRef.current += 1;
          setDisplayAttempt(attemptRef.current);
          setTimeout(attempt, delay);
        }
      };

      attempt();
    };

    run();
    return () => { cancelled = true; };
  }, [isActive]); // isActive only — callback changes must not re-trigger a save

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-sm gap-4">
      <Loader2 className="size-10 animate-spin text-primary" />
      <p className="text-base font-medium text-zinc-200">Saving your project…</p>
      {displayAttempt > 0 && (
        <p className="text-sm text-zinc-500">
          {displayAttempt > 5
            ? 'Still trying — check your connection'
            : 'Having trouble connecting, retrying…'}
        </p>
      )}
    </div>
  );
}
