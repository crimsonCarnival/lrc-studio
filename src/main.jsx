import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

// Auto-reload when a new deployment invalidates lazy-loaded chunks
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
import { Toaster } from 'react-hot-toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { useAuthContext } from './contexts/useAuthContext.js'
import { Spinner } from './components/ui/skeleton'
import './i18n.js'

const AuthPage = lazy(() => import('./components/Auth/AuthPage.jsx'));
const SharedProjectViewer = lazy(() => import('./components/shared/SharedProjectViewer.jsx'));

// Wrapper for SharedProjectViewer to get the id param
function SharedProjectRoute() {
  const { id } = useParams();
  return <SharedProjectViewer projectId={id} />;
}

// Protected Route Wrapper
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return children;
}

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
        
        {/* Auth routes */}
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <AuthPage tab="login" />} />
        <Route path="/register" element={user ? <Navigate to="/home" replace /> : <AuthPage tab="register" />} />
        
        {/* Protected app routes - App handles nested routing inside itself */}
        <Route path="/*" element={
          <ProtectedRoute>
            <TooltipProvider>
              <App />
            </TooltipProvider>
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <RootRoutes />
        </BrowserRouter>
      </AuthProvider>
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
