import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

// Auto-reload when a new deployment invalidates lazy-loaded chunks
// window.addEventListener('vite:preloadError', () => {
// window.location.reload();
// });
import { Toaster } from 'react-hot-toast'
import { TooltipProvider } from '@ui/tooltip'
import './index.css';
import './i18n.js';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import App from './App.jsx'
import ErrorBoundary from '@shared/ErrorBoundary.jsx'

function LanguageSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, [i18n.language]);
  return null;
}
import { AuthProvider } from './contexts/AuthContext.jsx'
import { useAuthContext } from './contexts/useAuthContext.js'
import { Spinner } from '@ui/skeleton'
import { AppProviders } from './app/AppProviders';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

// eslint-disable-next-line react-refresh/only-export-components
const AuthPage = lazy(() => import('@features/auth/AuthPage.jsx'));
// eslint-disable-next-line react-refresh/only-export-components
const SharedProjectViewer = lazy(() => import('@shared/SharedProjectViewer.jsx'));

// Wrapper for SharedProjectViewer to get the id param
// eslint-disable-next-line react-refresh/only-export-components
function SharedProjectRoute() {
  const { id } = useParams();
  return <SharedProjectViewer projectId={id} />;
}

// Protected Route Wrapper
// eslint-disable-next-line react-refresh/only-export-components
function ProtectedRoute({ children }) {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size={24} className="text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?action=signin&redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return children;
}

// eslint-disable-next-line react-refresh/only-export-components
function AuthRedirect({ defaultTo = '/home' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || defaultTo;
  return <Navigate to={redirect} replace />;
}

// eslint-disable-next-line react-refresh/only-export-components
function RootRoutes() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size={24} className="text-primary" />
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size={24} className="text-primary" />
      </div>
    }>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/share/:id" element={<SharedProjectRoute />} />

        {/* Legacy redirects */}
        <Route path="/login" element={<Navigate to="/auth?action=signin" replace />} />
        <Route path="/register" element={<Navigate to="/auth?action=signup" replace />} />

        {/* Auth routes */}
        <Route path="/auth" element={user ? <AuthRedirect /> : <AuthPage />} />

        {/* Protected app routes - App handles nested routing inside itself */}
        <Route path="/*" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_KEY}>
        <AuthProvider>
          <LanguageSync />
          <AppProviders>
            <BrowserRouter>
              <RootRoutes />
            </BrowserRouter>
          </AppProviders>
        </AuthProvider>
      </GoogleReCaptchaProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#f4f4f5',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '0.625rem 1rem',
          },
          success: {
            iconTheme: { primary: '#1DB954', secondary: '#09090b' },
            duration: 2000,
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#09090b' },
            duration: 4000,
          },
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
)
