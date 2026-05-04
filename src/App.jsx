import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from './contexts/useAuthContext';
import { useAppState } from './hooks/useAppState';
import { useSettings } from './contexts/useSettings';
import { useScrollLock } from './hooks/useScrollLock';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { matchKey } from './utils/keyboard';
import BannedScreen from '@shared/BannedScreen';

import { AppProviders } from './app/AppProviders';
import { AppLayout } from './app/AppLayout';
import { AppRouter } from './app/AppRouter';

function AppInner() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, updateSetting, syncFromServer } = useSettings();

  const appState = useAppState();
  const {
    pendingProject,
    resetAppState,
    playerRef,
    setLines,
    setEditorMode,
    setSyncMode,
  } = appState;

  useScrollLock(!!pendingProject);
  useNetworkStatus();

  // Sync settings from server when user logs in
  useEffect(() => {
    if (user) syncFromServer();
  }, [user, syncFromServer]);

  // Layout-specific state
  const rawFocusMode = settings.interface?.focusMode || 'default';
  const focusMode = ['default', 'sync', 'playback'].includes(rawFocusMode) ? rawFocusMode : 'default';
  const [hideEditor, setHideEditor] = useState(false);
  const [unsavedModalTarget, setUnsavedModalTarget] = useState(null);
  const [mobileTab, setMobileTab] = useState('editor');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);


  // Called by SetupScreen when user clicks Next with audio + lyrics
  const handleSetupComplete = useCallback(({ lines, editorMode }) => {
    setLines(lines);
    setEditorMode(editorMode);
    setSyncMode(true);
    navigate('/project/local');
  }, [setLines, setEditorMode, setSyncMode, navigate]);

  const isReady = location.pathname.startsWith('/project/') && location.pathname !== '/project/new';

  const setFocusMode = useCallback((mode) => {
    updateSetting('interface.focusMode', mode);
  }, [updateSetting]);

  // Focus mode keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (matchKey(e, settings.shortcuts?.focusSync?.[0] || 'Ctrl+1')) {
        e.preventDefault();
        setFocusMode(focusMode === 'sync' ? 'default' : 'sync');
      } else if (matchKey(e, settings.shortcuts?.focusPreview?.[0] || 'Ctrl+2')) {
        e.preventDefault();
        if (focusMode === 'playback') {
          setFocusMode('default');
          setHideEditor(false);
        } else {
          setHideEditor(h => !h);
        }
      } else if (matchKey(e, settings.shortcuts?.focusPlayback?.[0] || 'Ctrl+3')) {
        e.preventDefault();
        setFocusMode(focusMode === 'playback' ? 'default' : 'playback');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.shortcuts, focusMode, setFocusMode]);

  // Pause player when navigating away
  useEffect(() => {
    if (!location.pathname.startsWith('/project/')) {
      playerRef.current?.pause?.();
    }
  }, [location.pathname, playerRef]);

  // Reset project state when entering "New Project"
  useEffect(() => {
    if (location.pathname === '/project/new') {
      resetAppState();
    }
  }, [location.pathname, resetAppState]);

  // Grid column classes
  const editorColClass = useMemo(() => (({
    default: 'lg:col-span-7',
    sync: 'lg:col-span-8',
    playback: 'hidden',
  }[focusMode]) || 'lg:col-span-7'), [focusMode]);

  const previewColClass = useMemo(() => ((hideEditor || focusMode === 'playback')
    ? 'lg:col-span-12'
    : ({ default: 'lg:col-span-5', sync: 'lg:col-span-4' }[focusMode] || 'lg:col-span-5')), [hideEditor, focusMode]);

  const showEditor = focusMode !== 'playback' && !hideEditor;
  const showPreview = true;

  if (user?.isBanned) return <BannedScreen />;

  const layoutState = {
    focusMode,
    setFocusMode,
    hideEditor,
    setHideEditor,
    unsavedModalTarget,
    setUnsavedModalTarget,
    mobileTab,
    setMobileTab,
    isReady,
    editorColClass,
    previewColClass,
    showEditor,
    showPreview
  };

  // Enhance appState with layout-driven state
  const enhancedAppState = {
    ...appState,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    handleSetupComplete,
  };

  return (
    <AppLayout
      user={user}
      logout={logout}
      appState={enhancedAppState}
      settingsState={{ settings, updateSetting }}
      layoutState={layoutState}
    >
      <AppRouter
        appState={enhancedAppState}
        layoutState={layoutState}
        navigate={navigate}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppInner />
    </AppProviders>
  );
}
