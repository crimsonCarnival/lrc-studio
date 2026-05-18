import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '@/features/auth/useAuthContext';
import { useAppState } from '@/shared/hooks/useAppState';
import { useSettings } from '@/features/settings/useSettings';
import { useScrollLock } from '@/shared/hooks/useScrollLock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { matchKey } from '@/shared/utils/keyboard';
import { useUrlParamsSync } from '@/shared/hooks/useUrlParamsSync';
import BannedScreen from '@features/auth/components/BannedScreen';
import GuestProjectSaveGate from '@features/editor/components/core/GuestProjectSaveGate';

import { AppLayout } from './AppLayout';
import { AppRouter } from './AppRouter';

function AppInner() {
  useTranslation();
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const routerLocation = useLocation();
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
    noMediaSetupData,
    setNoMediaSetupData,
  } = appState;

  useScrollLock(!!pendingProject);
  useNetworkStatus();

  // Sync settings from server when user logs in
  useEffect(() => {
    if (user) syncFromServer();
  }, [user, syncFromServer]);

  // Promote /project/local → /project/:id once the server assigns a real ID
  useEffect(() => {
    if (user && activeProjectId && routerLocation.pathname === '/project/local') {
      navigate(`/project/${activeProjectId}`, { replace: true });
    }
  }, [user, activeProjectId, routerLocation.pathname, navigate]);

  const isProjectPage = routerLocation.pathname.startsWith('/project/') && routerLocation.pathname !== '/project/new';
  const isSetupPage = routerLocation.pathname === '/project/new';
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

  // Layout-specific state
  const [ui, setUi] = useState({
    hideEditor: false,
    unsavedModalTarget: null,
    isPlaying: false,
    playbackSpeed: 1,
    showNamingModal: false,
  });

  const { hideEditor, unsavedModalTarget, isPlaying, playbackSpeed, showNamingModal } = ui;
  const setHideEditor = useCallback((val) => setUi(prev => ({ ...prev, hideEditor: typeof val === 'function' ? val(prev.hideEditor) : val })), []);
  const setUnsavedModalTarget = useCallback((val) => setUi(prev => ({ ...prev, unsavedModalTarget: val })), []);
  const setIsPlaying = useCallback((val) => setUi(prev => ({ ...prev, isPlaying: val })), []);
  const setPlaybackSpeed = useCallback((val) => setUi(prev => ({ ...prev, playbackSpeed: val })), []);
  const setShowNamingModal = useCallback((val) => setUi(prev => ({ ...prev, showNamingModal: val })), []);

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
    isPublic,
    songName,
    songArtist,
    songAlbum,
    songYear
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

    const newMetadata = { description: description || '', tags: tags || [], songName: songName || '', songArtist: songArtist || '', songAlbum: songAlbum || '', songYear: songYear || '' };
    appState.setProjectMetadata(newMetadata);

    if (!user) {
      // Guest: handleManualSave writes to localStorage only (no token).
      // The editor's Save button uses the server-side claim flow instead.
      await appState.handleManualSave({ title: finalTitle, metadata: newMetadata, isPublic, lines, editorMode, syncMode: true });
      navigate('/project/local');
      return;
    }

    await appState.handleManualSave({
      title: finalTitle,
      metadata: newMetadata,
      isPublic,
      lines,
      editorMode,
      syncMode: true
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
  }, [settings.shortcuts, focusMode, setFocusMode, setHideEditor]);

  // Pause player when navigating away
  useEffect(() => {
    if (!routerLocation.pathname.startsWith('/project/')) {
      playerRef.current?.pause?.();
    }
  }, [routerLocation.pathname, playerRef]);

  // Reset load errors when navigating
  useEffect(() => {
    if (appState.loadError) appState.setLoadError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.pathname, appState.loadError, appState.setLoadError]);

  // Redirect to setup when a loaded project has no media, carrying all project data for pre-fill
  useEffect(() => {
    if (!noMediaSetupData) return;
    setNoMediaSetupData(null);
    navigate('/project/new', { state: { prefill: noMediaSetupData }, replace: true });
  }, [noMediaSetupData, setNoMediaSetupData, navigate]);

  // Reset project state when entering "New Project" — but not when coming from no-media rollback
  useEffect(() => {
    if (routerLocation.pathname === '/project/new' && !routerLocation.state?.prefill) {
      resetAppState();
    }
  }, [routerLocation.pathname, routerLocation.state?.prefill, resetAppState]);

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
    <>
      <GuestProjectSaveGate />
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
    </>
  );
}

export default function App() {
  return <AppInner />;
}