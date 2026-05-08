import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { SkeletonPlayer } from '@ui/skeleton';
import Player from '@features/player/Player';
import { useSettings } from '@/contexts/useSettings';

/**
 * Docked player bar — desktop bottom, mobile above tab bar.
 * Hidden during setup phase but stays mounted to keep playerRef alive.
 */
export function AppPlayer({
  isReady,
  isPlayerMounted,
  isProjectLoading,
  playerRef,
  mediaTitle,
  setMediaTitle,
  setIsPlaying,
  setPlaybackSpeed,
  handleTimeUpdate,
  handleDurationChange,
  handleMediaChange,
  handleYtUrlChange,
  handleCloudinaryUpload,
  restoredYtUrl,
  restoredCloudinaryUpload,
  restoredPosition,
  restoredSpeed,
  projectMetadata,
  lines,
  playbackPosition,
  syncMode,
  playerTop,
  hasMedia,
  setProjectSpotifyTrackId,
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const { updateSetting } = useSettings();

  const positionClass = playerTop
    ? 'lg:top-[88px] lg:bottom-auto bottom-14 top-auto'
    : 'bottom-14 lg:bottom-6 top-auto';

  if (!isPlayerMounted) return null;

  return (
    <div
      className={`fixed inset-x-0 ${positionClass} z-player px-0 lg:px-6 pointer-events-none transition-all duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0 translate-y-12'}`}
    >
      <div className={`max-w-[1600px] mx-auto w-full bg-zinc-900/95 backdrop-blur-lg max-lg:border-y lg:border-2 border-zinc-700/50 max-lg:rounded-none lg:rounded-2xl shadow-elevated ${isReady ? 'pointer-events-auto' : 'pointer-events-none'} flex flex-col lg:flex-row items-center justify-center lg:min-h-[80px] ${hasMedia ? 'lg:max-h-[112px]' : ''} overflow-visible lg:px-6 py-2 lg:py-4 relative transition-all duration-500 ${isReady ? '' : 'scale-95'}`}>
        {isProjectLoading && isReady ? (
          <SkeletonPlayer />
        ) : (
          <Player
            ref={playerRef}
            mediaTitle={mediaTitle}
            onPlayingChange={setIsPlaying}
            onSpeedChange={setPlaybackSpeed}
            onTitleChange={(newTitle) => {
              const isSetupPhase = location.pathname === '/project/new';
              if (
                isSetupPhase ||
                !mediaTitle ||
                mediaTitle === t('library.untitled') ||
                mediaTitle === 'Untitled'
              ) {
                setMediaTitle(newTitle);
              }
            }}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onMediaChange={handleMediaChange}
            onYtUrlChange={handleYtUrlChange}
            onCloudinaryUpload={handleCloudinaryUpload}
            initialYtUrl={restoredYtUrl}
            initialCloudinaryUpload={restoredCloudinaryUpload}
            initialSeek={restoredPosition}
            initialSpeed={restoredSpeed}
            projectMetadata={projectMetadata}
            lines={lines}
            playbackPosition={playbackPosition}
            syncMode={syncMode}
            playerTop={playerTop}
            onDockToggle={() => updateSetting('interface.playerTop', !playerTop)}
            onSpotifyTrackIdChange={setProjectSpotifyTrackId}
            hasMedia={hasMedia}
          />
        )}
      </div>
    </div>
  );
}
