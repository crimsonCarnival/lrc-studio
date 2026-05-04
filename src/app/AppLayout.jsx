import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UploadCloud } from 'lucide-react';

import { AppBackground } from './layout/AppBackground';
import { AppHeader } from './layout/AppHeader';
import { AppPlayer } from './layout/AppPlayer';
import { AppMobileNav } from './layout/AppMobileNav';
import { AppModals } from './layout/AppModals';

export function AppLayout({ children, user, logout, appState, settingsState, layoutState }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    mediaTitle, setMediaTitle, showKeyboardHelp, setShowKeyboardHelp,
    showSettings, setShowSettings, isDraggingFile, playerRef,
    handleManualSave, triggerImportSave, handleDiscardProject, handleRestoreProject,
    handleTimeUpdate, handleDurationChange, handleMediaChange, handleYtUrlChange,
    handleCloudinaryUpload, restoredYtUrl, restoredCloudinaryUpload, restoredPosition,
    restoredSpeed, hasUnsavedChanges, activeProjectId, projectMetadata, setProjectMetadata,
    isProjectLoading, lines, playbackPosition, syncMode, pendingProject,
    setIsPlaying, setPlaybackSpeed,
  } = appState;

  const { settings, updateSetting } = settingsState;
  const { focusMode, setFocusMode, hideEditor, setHideEditor, mobileTab, setMobileTab, isReady, setUnsavedModalTarget } = layoutState;

  // Project naming modal state lives here — it bridges appState + layout
  const [showNamingModal, setShowNamingModal] = useState(false);

  const handleProjectConfirm = useCallback(({ name, description, tags }) => {
    const newTitle = name || mediaTitle || '';
    const newMetadata = { description: description || '', tags: tags || [] };
    setMediaTitle(newTitle);
    setProjectMetadata(newMetadata);
    setShowNamingModal(false);
    handleManualSave({ title: newTitle, metadata: newMetadata });
    if (!activeProjectId || location.pathname === '/project/new') {
      navigate('/project/local');
    }
  }, [mediaTitle, setMediaTitle, setProjectMetadata, navigate, activeProjectId, handleManualSave, location.pathname]);

  return (
    <div className="min-h-screen lg:h-screen bg-zinc-950 relative overflow-x-hidden lg:overflow-y-hidden flex flex-col">
      <AppBackground />

      {/* Drag overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none transition-all">
          <div className="flex flex-col items-center gap-4 text-primary animate-bounce">
            <UploadCloud className="w-20 h-20" />
            <h2 className="text-3xl font-bold tracking-tight text-center px-4">
              {t('player.dropAudio') || 'Drop your audio or lyrics file here'}
            </h2>
          </div>
        </div>
      )}

      <AppHeader
        user={user}
        logout={logout}
        isReady={isReady}
        lines={lines}
        mediaTitle={mediaTitle}
        setMediaTitle={setMediaTitle}
        triggerImportSave={triggerImportSave}
        hasUnsavedChanges={hasUnsavedChanges}
        activeProjectId={activeProjectId}
        setShowSettings={setShowSettings}
        setShowKeyboardHelp={setShowKeyboardHelp}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        hideEditor={hideEditor}
        setHideEditor={setHideEditor}
        setUnsavedModalTarget={setUnsavedModalTarget}
        settings={settings}
        updateSetting={updateSetting}
        i18n={i18n}
      />

      <div className={`relative z-base max-w-7xl mx-auto w-full flex-1 min-h-0 px-2 sm:px-4 lg:px-6 lg:pb-4 flex flex-col ${isReady ? 'max-lg:pb-[144px]' : ''}`}>
        {children}
      </div>

      <AppPlayer
        isReady={isReady}
        isProjectLoading={isProjectLoading}
        playerRef={playerRef}
        mediaTitle={mediaTitle}
        setMediaTitle={setMediaTitle}
        setIsPlaying={setIsPlaying}
        setPlaybackSpeed={setPlaybackSpeed}
        handleTimeUpdate={handleTimeUpdate}
        handleDurationChange={handleDurationChange}
        handleMediaChange={handleMediaChange}
        handleYtUrlChange={handleYtUrlChange}
        handleCloudinaryUpload={handleCloudinaryUpload}
        restoredYtUrl={restoredYtUrl}
        restoredCloudinaryUpload={restoredCloudinaryUpload}
        restoredPosition={restoredPosition}
        restoredSpeed={restoredSpeed}
        projectMetadata={projectMetadata}
        lines={lines}
        playbackPosition={playbackPosition}
        syncMode={syncMode}
      />

      <AppMobileNav
        isReady={isReady}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        activeProjectId={activeProjectId}
      />

      <AppModals
        showKeyboardHelp={showKeyboardHelp}
        setShowKeyboardHelp={setShowKeyboardHelp}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        handleManualSave={handleManualSave}
        showNamingModal={showNamingModal}
        setShowNamingModal={setShowNamingModal}
        handleProjectConfirm={handleProjectConfirm}
        mediaTitle={mediaTitle}
        projectMetadata={projectMetadata}
        pendingProject={pendingProject}
        handleDiscardProject={handleDiscardProject}
        handleRestoreProject={handleRestoreProject}
        unsavedModalTarget={layoutState.unsavedModalTarget}
        setUnsavedModalTarget={layoutState.setUnsavedModalTarget}
      />
    </div>
  );
}
