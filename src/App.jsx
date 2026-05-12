import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from './contexts/useAuthContext';
import { useAppState } from './hooks/useAppState';
import { useSettings } from './contexts/useSettings';
import { useScrollLock } from './hooks/useScrollLock';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { matchKey } from './utils/keyboard';
import { useUrlParamsSync } from './hooks/useUrlParamsSync';
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
    activeProjectId,
    setMediaTitle,
    handleYtUrlChange,
    handleCloudinaryUpload,
  } = appState;

  useScrollLock(!!pendingProject);
  useNetworkStatus();

  // Sync settings from server when user logs in
  useEffect(() => {
    if (user) syncFromServer();
  }, [user, syncFromServer]);

  // Promote /project/local → /project/:id once the server assigns a real ID
  useEffect(() => {
    if (activeProjectId && location.pathname === '/project/local') {
      navigate(`/project/${activeProjectId}`, { replace: true });
    }
  }, [activeProjectId, location.pathname, navigate]);

  // After a guest signs up/in, migrate their localStorage project to the server.
  // The pendingGuestSave flag is set either from setup completion or when a guest
  // clicks "Save" inside the editor and navigates to /auth from there.
  const guestSavePendingRef = useRef(!!sessionStorage.getItem('pendingGuestSave'));
  useEffect(() => {
    if (!guestSavePendingRef.current) return;
    if (!user) return;
    if (appState.lines.length === 0) return;
    if (appState.activeProjectId) return;
    if (appState.isProjectLoading) return;

    guestSavePendingRef.current = false;
    sessionStorage.removeItem('pendingGuestSave');
    appState.handleManualSave();
  }, [user, appState.lines.length, appState.activeProjectId, appState.isProjectLoading, appState.handleManualSave]);

  const isProjectPage = location.pathname.startsWith('/project/') && location.pathname !== '/project/new';
  const isSetupPage = location.pathname === '/project/new';
  const isReady = isProjectPage;
  const isPlayerMounted = isProjectPage || isSetupPage;

  // Layout-specific state
  const rawFocusMode = settings.interface?.focusMode || 'default';
  const focusMode = ['default', 'sync', 'playback'].includes(rawFocusMode) ? rawFocusMode : 'default';
  const layoutSwap = settings.interface?.layoutSwap || false;
  const playerTop = settings.interface?.playerTop || false;
  const editorWidth = settings.interface?.editorWidth ?? 50;
  const lockLayout = settings.interface?.lockLayout || false;
  const mobileTab = settings.interface?.mobileTab || 'editor';

  const [hideEditor, setHideEditor] = useState(false);
  const [unsavedModalTarget, setUnsavedModalTarget] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showNamingModal, setShowNamingModal] = useState(false);

  // Called by SetupScreen when user finishes the 3-step setup
  const handleSetupComplete = useCallback(async ({
    lines,
    editorMode,
    audioSource,
    ytUrl,
    audioName,
    selectedUpload,
    name,
    description,
    tags,
    isPublic
  }) => {
    setLines(lines);
    setEditorMode(editorMode);
    setSyncMode(true);

    const effectiveYtUrl = ytUrl || appState.projectYtUrl;
    let finalTitle = name || audioName || '';

    if (audioSource === 'youtube' && effectiveYtUrl) {
      if (ytUrl) handleYtUrlChange(ytUrl);
      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(effectiveYtUrl)}&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(oEmbedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.title && !name) finalTitle = data.title;
        }
      } catch {
        // oEmbed failed or timed out — leave finalTitle as-is
      }
    } else if (audioSource === 'cloud' && selectedUpload) {
      handleCloudinaryUpload(selectedUpload);
    }

    setMediaTitle(finalTitle);

    const newMetadata = { description: description || '', tags: tags || [] };
    appState.setProjectMetadata(newMetadata);

    if (!user) {
      // Guest: handleManualSave is already localStorage-only when no token exists.
      // Set a flag so the post-login migration effect picks it up and syncs to DB.
      await appState.handleManualSave({ title: finalTitle, metadata: newMetadata, isPublic });
      sessionStorage.setItem('pendingGuestSave', '1');
      navigate('/project/local');
      return;
    }

    await appState.handleManualSave({
      title: finalTitle,
      metadata: newMetadata,
      isPublic
    });

    navigate('/project/local');
  }, [setLines, setEditorMode, setSyncMode, setMediaTitle, handleYtUrlChange, handleCloudinaryUpload, appState, navigate, user]);

  const setFocusMode = useCallback((mode) => {
    updateSetting('interface.focusMode', mode);
  }, [updateSetting]);

  const setLayoutSwap = useCallback((swap) => {
    updateSetting('interface.layoutSwap', swap);
  }, [updateSetting]);

  const setPlayerTop = useCallback((top) => {
    updateSetting('interface.playerTop', top);
  }, [updateSetting]);

  const setEditorWidth = useCallback((width) => {
    updateSetting('interface.editorWidth', width);
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

  // Reset load errors when navigating
  useEffect(() => {
    if (appState.loadError) appState.setLoadError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, appState.loadError, appState.setLoadError]);

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

  const layoutState = {
    focusMode,
    setFocusMode,
    hideEditor,
    setHideEditor,
    unsavedModalTarget,
    setUnsavedModalTarget,
    mobileTab,
    setMobileTab: useCallback((tab) => updateSetting('interface.mobileTab', tab), [updateSetting]),
    isReady,
    isPlayerMounted,
    editorColClass,
    previewColClass,
    showEditor,
    showPreview,
    layoutSwap,
    setLayoutSwap,
    playerTop,
    setPlayerTop,
    editorWidth,
    setEditorWidth,
    lockLayout,
    setLockLayout: useCallback((lock) => updateSetting('interface.lockLayout', lock), [updateSetting]),
    showNamingModal,
    setShowNamingModal,
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

  useUrlParamsSync(enhancedAppState, layoutState);

  if (user?.isBanned) return <BannedScreen />;

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
  return <AppInner />;
}