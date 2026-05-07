import { useCallback } from 'react';
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
    isProjectLoading, hasMedia, lines, activeLineIndex, playbackPosition, syncMode, pendingProject,
    setIsPlaying, setPlaybackSpeed, setProjectSpotifyTrackId,
  } = appState;

  const { settings, updateSetting } = settingsState;
  const { focusMode, setFocusMode, hideEditor, setHideEditor, mobileTab, setMobileTab, isReady, isPlayerMounted, setUnsavedModalTarget, playerTop, showNamingModal, setShowNamingModal } = layoutState;

  const handleProjectConfirm = useCallback(({ name, description, tags }) => {
    const newTitle = name || mediaTitle || '';
    const newMetadata = { description: description || '', tags: tags || [] };
    setMediaTitle(newTitle);
    setProjectMetadata(newMetadata);
    setShowNamingModal(false);
    handleManualSave({ title: newTitle, metadata: newMetadata });
    navigate('/project/local');
  }, [mediaTitle, setMediaTitle, setProjectMetadata, navigate, handleManualSave, setShowNamingModal]);

  return (
    <div className="min-h-screen lg:h-screen bg-zinc-950 relative overflow-hidden flex flex-col">
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

      {/* Main Workspace Wrapper */}
      <div className={`relative z-base flex-1 min-h-0 px-0 lg:px-6 flex flex-col transition-[padding] duration-500 ease-in-out
        ${
          location.pathname === '/' ? 'pt-16'
          : (playerTop && isReady && isPlayerMounted) ? 'pt-[200px] lg:pt-[216px]'
          : 'pt-24 lg:pt-[104px]'
        }
        ${(isPlayerMounted && !playerTop) ? 'max-lg:pb-[240px] lg:pb-[160px]' : 'pb-20 lg:pb-6'}
      `}
        style={(isPlayerMounted && !playerTop && window.innerWidth >= 1024) ? { marginBottom: '24px' } : undefined}
      >
        <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>

      <AppPlayer
        isReady={isReady}
        isPlayerMounted={isPlayerMounted}
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
        activeLineIndex={activeLineIndex}
        playbackPosition={playbackPosition}
        syncMode={syncMode}
        playerTop={playerTop}
        hasMedia={hasMedia}
        setProjectSpotifyTrackId={setProjectSpotifyTrackId}
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
