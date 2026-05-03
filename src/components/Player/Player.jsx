import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/useSettings';
import useConfirm from '../../hooks/useConfirm';
import { formatTime } from '../../utils/formatTime';
import useLocalAudio from './useLocalAudio';
import useYouTubePlayer from './useYouTubePlayer';
import useSpotifyPlayer from './useSpotifyPlayer';
import SpotifyBrowser from './SpotifyBrowser';
import WaveformDisplay from './WaveformDisplay';
import VolumeControl from './VolumeControl';
import SpeedControl from './SpeedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Music2, AlertTriangle, Play, Pause, Headphones, FolderOpen, Repeat, ChevronLeft, ChevronRight, SkipBack, SkipForward, Cloud, Video, ChevronDown } from 'lucide-react';
import { Tip } from '@/components/ui/tip';
import { uploads as uploadsApi, spotify as spotifyApi, getAccessToken } from '../../api';
import SpotifyIcon from '../shared/SpotifyIcon';
import toast from 'react-hot-toast';

const ALL_SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

const Player = forwardRef(function Player(
  { onTimeUpdate, onDurationChange, onMediaChange, playerRef: _legacyRef, mediaTitle, onTitleChange, initialYtUrl, onYtUrlChange, initialSeek, initialSpeed, lines, playbackPosition, syncMode = false, onCloudinaryUpload, projectMetadata },
  ref,
) {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const MIN_SPEED = settings.playback?.speedBounds?.min ?? 0.25;
  const MAX_SPEED = settings.playback?.speedBounds?.max ?? 3;
  const SPEED_PRESETS = useMemo(
    () =>
      (settings.playback?.speedPresets || ALL_SPEED_PRESETS).filter(
        (s) => s >= MIN_SPEED && s <= MAX_SPEED,
      ),
    [MIN_SPEED, MAX_SPEED, settings.playback?.speedPresets],
  );

  const [source, setSource] = useState('local');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const s = parseFloat(initialSpeed);
    return (isFinite(s) && s > 0) ? s : 1;
  });
  const [requestConfirm, confirmModal] = useConfirm();

  // Uploads state
  const [mediaUploads, setMediaUploads] = useState([]);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);

  // A-B Loop state
  const [loopA, setLoopA] = useState(null);
  const [loopB, setLoopB] = useState(null);
  const loopARef = useRef(null);
  const loopBRef = useRef(null);

  const audioRef = useRef(null);
  const localBlobRef = useRef(null);
  const ytContainerRef = useRef(null);

  const sourceRef = useRef(source);

  // Sync refs in effects (React 19 rules forbid ref writes during render)
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);
  useEffect(() => { sourceRef.current = source; }, [source]);

  // Fetch uploads when opening the selector
  const fetchUploads = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const { uploads } = await uploadsApi.listMedia();
      setMediaUploads(uploads || []);
    } catch { /* ignore */ }
    setUploadsLoaded(true);
  }, []);

  const updateTime = useCallback(
    (time) => {
      // A-B loop enforcement
      const a = loopARef.current;
      const b = loopBRef.current;
      if (a != null && b != null && time >= b) {
        if (sourceRef.current === 'local' && audioRef.current) {
          audioRef.current.currentTime = a;
        }
        // YouTube loop is handled via yt.seek in the effect below
        setCurrentTime(a);
        onTimeUpdate?.(a);
        return;
      }
      setCurrentTime(time);
      onTimeUpdate?.(time);
    },
    [onTimeUpdate],
  );

  const updateDuration = useCallback(
    (d) => {
      setDuration(d);
      onDurationChange?.(d);
    },
    [onDurationChange],
  );

  const local = useLocalAudio({
    audioRef,
    blobRef: localBlobRef,
    t,
    settings,
    updateTime,
    updateDuration,
    setSource,
    setIsPlaying,
    setCurrentTime,
    onTitleChange,
    onMediaChange,
    onCloudinaryUpload,
    initialSpeed,
  });

  const yt = useYouTubePlayer({
    containerRef: ytContainerRef,
    t,
    settings,
    updateTime,
    updateDuration,
    setIsPlaying,
    setCurrentTime,
    onTitleChange,
    onMediaChange,
    isPlaying,
    setSource,
    initialYtUrl,
    onYtUrlChange,
  });

  const sp = useSpotifyPlayer({
    updateTime,
    updateDuration,
    setIsPlaying,
    setCurrentTime,
    setSource,
    onTitleChange,
    onMediaChange,
  });

  // Spotify URL input state
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [spotifyError, setSpotifyError] = useState('');
  const [showSpotifyBrowser, setShowSpotifyBrowser] = useState(false);

  const handleSpotifyBrowserSelect = useCallback((track) => {
    sp.playTrack(track.trackId, track.title || track.name || '');
    setShowSpotifyBrowser(false);
  }, [sp]);

  const [syncingNowPlaying, setSyncingNowPlaying] = useState(false);
  const handleSyncNowPlaying = useCallback(async () => {
    setSyncingNowPlaying(true);
    try {
      const data = await spotifyApi.getCurrentlyPlaying();
      if (data?.track?.trackId) {
        sp.playTrack(data.track.trackId, data.track.name || '');
      } else {
        toast(t('spotify.nothingPlaying'));
      }
    } catch {
      toast.error(t('spotify.syncFailed'));
    } finally {
      setSyncingNowPlaying(false);
    }
  }, [sp, t]);

  const hasMedia = (source === 'local' && local.localUrl) || (source === 'youtube' && yt.ytReady) || (source === 'spotify' && sp.ready);

  const handleSelectUpload = useCallback((upload) => {
    if (upload.source === 'youtube' && upload.youtubeUrl) {
      yt.setYtUrl(upload.youtubeUrl);
      setTimeout(() => yt.loadYouTube(), 0);
    } else if (upload.source === 'spotify' && upload.spotifyTrackId) {
      sp.playTrack(upload.spotifyTrackId, upload.title || upload.artist || '', false);
      onTitleChange?.(upload.title || upload.artist || '');
    } else if (upload.source === 'cloudinary' && upload.cloudinaryUrl) {
      fetch(upload.cloudinaryUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], upload.fileName || 'audio.mp3', { type: blob.type || 'audio/mpeg' });
          local.handleFileChange({ target: { files: [file] } });
        })
        .catch(() => { });
    }
  }, [local, yt, sp, onTitleChange]);

  // ——— Unified controls ———

  const togglePlay = useCallback(() => {
    if (source === 'local' && audioRef.current) {
      if (isPlaying) local.pause();
      else local.play();
      setIsPlaying(!isPlaying);
    } else if (source === 'youtube' && yt.ytReady) {
      if (isPlaying) yt.pause();
      else yt.play();
    } else if (source === 'spotify' && sp.ready) {
      if (isPlaying) sp.pause();
      else sp.play();
    }
  }, [source, isPlaying, local, yt, sp]);

  const seek = useCallback(
    (time) => {
      if (source === 'local') local.seek(time);
      else if (source === 'youtube') yt.seek(time);
      else if (source === 'spotify') sp.seek(time);
    },
    [source, local, yt, sp],
  );

  const applySpeed = useCallback(
    (speed) => {
      const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, parseFloat(speed) || 1));
      setPlaybackSpeed(clamped);
      if (source === 'local') local.setSpeed(clamped);
      else if (source === 'youtube') yt.setSpeed(clamped);
      // Spotify Web Playback SDK does not support speed control
    },
    [source, MIN_SPEED, MAX_SPEED, local, yt],
  );

  // ——— A-B Loop helpers ———
  const setLoop = useCallback((a, b) => {
    setLoopA(a);
    setLoopB(b);
  }, []);

  const clearLoop = useCallback(() => {
    setLoopA(null);
    setLoopB(null);
  }, []);

  // ——— Expose player API via ref ———

  useImperativeHandle(
    ref ?? _legacyRef,
    () => ({
      getCurrentTime: () =>
        source === 'local' ? local.getCurrentTime() : source === 'youtube' ? yt.getCurrentTime() : sp.getCurrentTime(),
      isPlaying: () => isPlaying,
      play: () => {
        if (!isPlaying) togglePlay();
      },
      pause: () => {
        if (isPlaying) togglePlay();
      },
      togglePlay: () => togglePlay(),
      adjustSpeed: (delta) => applySpeed(Math.round((playbackSpeed + delta) * 1000) / 1000),
      getSpeed: () => playbackSpeed,
      seek,
      getAudioBlob: () => localBlobRef.current || null,
      loadLocalAudio: (file) => local.handleFileChange(file),
      loadYouTube: (url) => yt.loadYouTube(url),
      loadSpotify: (trackId, title, autoPlay = false) => sp.playTrack(trackId, title, autoPlay),
      setLoop,
      clearLoop,
      getLoop: () => ({ a: loopA, b: loopB }),
    }),
    [source, isPlaying, togglePlay, seek, local, yt, sp, applySpeed, playbackSpeed, setLoop, clearLoop, loopA, loopB],
  );

  // ——— Apply restored seek/speed once after YouTube media is ready ———
  const restoredValuesAppliedRef = useRef(false);
  useEffect(() => {
    if (yt.ytReady && !restoredValuesAppliedRef.current) {
      restoredValuesAppliedRef.current = true;
      if (initialSeek > 0) yt.seek(initialSeek);
      // Apply speed directly to YouTube player (external call only)
      if (initialSpeed && initialSpeed !== 1) yt.setSpeed(initialSpeed);
      // Ensure the player doesn't autoplay after restoring position
      yt.pause();
    }
  }, [yt.ytReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Remove media ———

  const removeMedia = useCallback(() => {
    requestConfirm(t('confirm.removeMedia') || 'Remove currently loaded media?', () => {
      if (source === 'local') local.remove();
      else if (source === 'youtube') yt.remove();
      else if (source === 'spotify') sp.remove();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      onTimeUpdate?.(0);
      onDurationChange?.(0);
      onTitleChange?.('');
      onMediaChange?.(false);
    });
  }, [source, local, yt, sp, requestConfirm, t, onTimeUpdate, onDurationChange, onTitleChange, onMediaChange]);

  return (
    <>
      {/* Always-rendered media elements – audio context must survive layout switches */}
      {source === 'local' && local.localUrl && (
        <audio
          ref={audioRef}
          src={local.localUrl}
          onTimeUpdate={local.handleTimeUpdate}
          onLoadedMetadata={local.handleLoadedMetadata}
          onPause={local.handlePause}
          className="hidden"
          crossOrigin="anonymous"
        />
      )}
      <div
        ref={ytContainerRef}
        className={`fixed -top-[9999px] -left-[9999px] w-0 h-0 opacity-0 pointer-events-none ${source === 'youtube' && yt.ytReady ? '' : 'hidden'}`}
      />

      {/* ─────────────── Desktop full card (hidden on mobile) ─────────────── */}
      <div className="max-lg:hidden glass rounded-xl sm:rounded-2xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-3 animate-fade-in overflow-visible">
        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-1">
          <h2 className="text-xs sm:text-sm font-semibold tracking-widest text-zinc-400 flex items-center gap-2 overflow-hidden flex-1 pb-0.5 min-w-0">
            <span className="uppercase shrink-0 text-xs sm:text-sm flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" />{t('player.title')}</span>
            {hasMedia && mediaTitle && (
              <div className="flex items-center gap-2 px-1.5 py-0.5 rounded text-xs min-w-0 flex-1">
                <span className="text-primary normal-case tracking-normal truncate">{mediaTitle}</span>
              </div>
            )}
          </h2>
        </div>

        {/* Loading placeholder while YouTube or Spotify initialises */}
        {!hasMedia && (yt.ytLoading || sp.loading) && (
          <div className="flex items-center justify-center gap-3 py-6 animate-fade-in">
            <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm text-zinc-400">{t('player.loading') || 'Loading…'}</span>
          </div>
        )}

        {/* Unified media loader — shown when no media is loaded */}
        {!hasMedia && !yt.ytLoading && !sp.loading && (
          <div className="animate-fade-in overflow-hidden">
            {/* Drop zone — hidden once a URL has been entered */}
            {!yt.ytUrl.trim() && (<>
              <label
                htmlFor="audio-file-input"
                className="flex items-center gap-3 px-3 py-3 cursor-pointer group transition-colors rounded-xl hover:bg-zinc-800/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) local.handleFileChange({ target: { files: [file] } });
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-zinc-700/60 transition-all flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{t('player.dropAudio')}</p>
                  <p className="text-[11px] text-zinc-600">{t('player.dropHint')}</p>
                </div>
                <input
                  id="audio-file-input"
                  type="file"
                  accept="audio/*"
                  onChange={local.handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Divider */}
              <div className="flex items-center gap-3 px-3 py-0.5">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{t('player.or')}</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
            </>)}

            {/* YouTube URL — always visible; shows clear button once a URL is present */}
            <div className="px-1 py-2 space-y-2">
              <div className="flex gap-2 items-center">
                {yt.ytUrl.trim() && (
                  <Tip content={t('player.clearUrl')}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => { yt.setYtUrl(''); yt.setYtError(''); }}
                      className="w-7 h-8 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 shrink-0"
                    >
                      ←
                    </Button>
                  </Tip>
                )}
                <div className="relative flex-1">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500/70 shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  <Input
                    id="youtube-url-input"
                    type="text"
                    value={yt.ytUrl}
                    onChange={(e) => { yt.setYtUrl(e.target.value); yt.setYtError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && yt.loadYouTube()}
                    placeholder={t('player.pasteUrl')}
                    className={`pl-7 bg-zinc-800/60 text-zinc-100 placeholder-zinc-500 ${yt.ytError ? 'border-red-500/70 focus-visible:ring-red-500/25' : 'border-zinc-700 focus-visible:ring-primary/25'}`}
                  />
                </div>
                <Button
                  id="load-youtube-btn"
                  onClick={yt.loadYouTube}
                  className="px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shrink-0"
                >
                  {t('player.load')}
                </Button>
              </div>
              {yt.ytError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5 animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {yt.ytError}
                </p>
              )}
            </div>

            {/* Spotify section */}
            {getAccessToken() && (
              <div className="px-1 py-2 space-y-2">
                <div className="flex items-center gap-3 px-2 py-0.5">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{t('player.or')}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {showSpotifyBrowser ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                        <SpotifyIcon className="w-3.5 h-3.5" />
                        {t('spotify.browse')}
                      </span>
                      <button onClick={() => setShowSpotifyBrowser(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                        {t('spotify.pasteUrl')}
                      </button>
                    </div>
                    <SpotifyBrowser
                      onSelectTrack={handleSpotifyBrowserSelect}
                      onClose={() => setShowSpotifyBrowser(false)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <SpotifyIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500/70 shrink-0 pointer-events-none" />
                        <Input
                          type="text"
                          value={spotifyUrl}
                          onChange={(e) => { setSpotifyUrl(e.target.value); setSpotifyError(''); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              spotifyApi.createUpload(spotifyUrl).then((result) => {
                                sp.playTrack(result.spotifyTrackId || result.trackMeta?.trackId, result.title || result.trackMeta?.name || '', false);
                                setSpotifyUrl('');
                              }).catch((err) => setSpotifyError(err.message || 'Invalid Spotify URL'));
                            }
                          }}
                          placeholder={t('player.pasteSpotifyUrl') || 'Paste Spotify track URL...'}
                          className={`pl-7 bg-zinc-800/60 text-zinc-100 placeholder-zinc-500 ${spotifyError ? 'border-red-500/70 focus-visible:ring-red-500/25' : 'border-zinc-700 focus-visible:ring-primary/25'}`}
                        />
                      </div>
                      <Button
                        onClick={() => {
                          spotifyApi.createUpload(spotifyUrl).then((result) => {
                            sp.playTrack(result.spotifyTrackId || result.trackMeta?.trackId, result.title || result.trackMeta?.name || '', false);
                            onTitleChange?.(result.title || result.trackMeta?.name || '');
                            setSpotifyUrl('');
                          }).catch((err) => setSpotifyError(err.message || 'Invalid Spotify URL'));
                        }}
                        className="px-4 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg shrink-0"
                      >
                        {t('player.load')}
                      </Button>
                    </div>
                    {spotifyError && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5 animate-fade-in">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {spotifyError}
                      </p>
                    )}
                    <div className="flex items-center gap-3 px-1">
                      <button
                        onClick={() => setShowSpotifyBrowser(true)}
                        className="flex items-center gap-1.5 text-[10px] text-green-400 hover:text-green-300 font-medium"
                      >
                        <SpotifyIcon className="w-3 h-3" />
                        {t('spotify.browseLibrary')}
                      </button>
                      <span className="text-zinc-700">·</span>
                      <button
                        onClick={handleSyncNowPlaying}
                        disabled={syncingNowPlaying}
                        className="flex items-center gap-1.5 text-[10px] text-green-400 hover:text-green-300 font-medium disabled:opacity-50"
                      >
                        <Headphones className="w-3 h-3" />
                        {syncingNowPlaying ? t('spotify.syncing') : t('spotify.syncNowPlaying')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Uploads selector */}
            {getAccessToken() && (
              <div className="px-1 pb-1">
                <div className="flex items-center gap-3 px-2 py-0.5 mb-1">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{t('player.or')}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <Popover onOpenChange={(open) => { if (open) fetchUploads(); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-700/60 hover:border-zinc-600 text-zinc-300 text-sm h-9"
                    >
                      <span className="flex items-center gap-2">
                        <Cloud className="w-3.5 h-3.5 text-zinc-500" />
                        {t('uploads.selectFromUploads')}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[200px] overflow-y-auto p-1" align="start">
                    {mediaUploads.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-3">{t('uploads.empty')}</p>
                    ) : (
                      mediaUploads.map((upload) => (
                        <button
                          key={upload.id}
                          onClick={() => handleSelectUpload(upload)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-zinc-700/60 transition-colors"
                        >
                          <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden bg-zinc-700/50 flex items-center justify-center">
                            {upload.thumbnailUrl ? (
                              <img
                                src={upload.thumbnailUrl}
                                alt={upload.title || 'Thumbnail'}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                              />
                            ) : null}
                            <div className={upload.thumbnailUrl ? 'hidden' : 'flex'} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                              {upload.source === 'youtube'
                                ? <Video className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                : upload.source === 'spotify'
                                  ? <SpotifyIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  : <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">
                              {upload.title || upload.fileName || upload.youtubeUrl || t('uploads.untitled')}
                            </p>
                            {upload.duration > 0 && (
                              <p className="text-[10px] text-zinc-500">{formatTime(upload.duration)}</p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}

        {/* Local audio waveform */}
        {source === 'local' && local.localUrl && (
          <div className="animate-fade-in space-y-3">
            <WaveformDisplay
              showWaveform={settings.playback?.showWaveform}
              waveformSnap={settings.playback?.waveformSnap}
              audioRef={audioRef}
              localUrl={local.localUrl}
              onTimeUpdate={onTimeUpdate}
              lines={lines}
              playbackPosition={playbackPosition}
              duration={duration}
            />
          </div>
        )}

        {(local.localUrl || yt.ytReady || sp.ready) && (
          <div className="space-y-1 sm:space-y-2 pt-1 sm:pt-2 animate-fade-in">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <Button
                id="play-pause-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? t('shortcuts.playPause') || 'Pause' : t('shortcuts.playPause') || 'Play'}
                className="w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-primary hover:bg-primary-dim text-zinc-950 hover:scale-105 active:scale-95 glow-primary flex-shrink-0 p-0"
              >
                {isPlaying ? (
                  <Pause className="w-3 sm:w-4 h-3 sm:h-4" fill="currentColor" />
                ) : (
                  <Play className="w-3 sm:w-4 h-3 sm:h-4 ml-0.5" fill="currentColor" />
                )}
              </Button>

              <span className="text-xs text-zinc-400 font-mono tabular-nums w-14 sm:w-[68px] text-right shrink-0">
                {formatTime(currentTime)}
              </span>

              {/* Frame step back */}
              <Tip content="-0.01s">
                <button
                  onClick={() => seek(Math.max(0, currentTime - 0.01))}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors flex-shrink-0 hidden sm:block"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </Tip>

              <div className="flex-1 min-w-0 relative">
                {/* A-B loop region overlay */}
                {loopA != null && loopB != null && duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-accent-purple/15 border-x border-accent-purple/40 rounded-sm pointer-events-none z-base"
                    style={{
                      left: `${(loopA / duration) * 100}%`,
                      width: `${((loopB - loopA) / duration) * 100}%`,
                    }}
                  />
                )}
                <input
                  id="seek-slider"
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  aria-label="Seek"
                  aria-valuenow={Math.round(currentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    // Shift-drag: 10:1 precision (move 1/10th of normal)
                    if (e.nativeEvent?.shiftKey) {
                      const delta = (raw - currentTime) / 10;
                      seek(Math.max(0, Math.min(duration, currentTime + delta)));
                    } else {
                      seek(raw);
                    }
                  }}
                  className="w-full relative z-raised"
                  style={{
                    background: `linear-gradient(to right, var(--color-primary) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255, 255, 255, 0.15) ${duration ? (currentTime / duration) * 100 : 0}%)`,
                  }}
                />
              </div>

              {/* Frame step forward */}
              <Tip content="+0.01s">
                <button
                  onClick={() => seek(Math.min(duration, currentTime + 0.01))}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors flex-shrink-0 hidden sm:block"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </Tip>

              <span className="text-xs text-zinc-400 font-mono tabular-nums w-14 sm:w-[68px] text-left shrink-0">
                {formatTime(duration)}
              </span>

              <VolumeControl />

              <Tip content={loopA != null && loopB != null
                ? `${t('player.loopActive') || 'Loop active'}: ${formatTime(loopA)} – ${formatTime(loopB)} (click to clear)`
                : t('player.setLoop') || 'Set A-B loop'
              }>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (loopA != null && loopB != null) {
                      clearLoop();
                    } else {
                      const now = source === 'local'
                        ? (audioRef.current?.currentTime ?? currentTime)
                        : source === 'youtube' ? (yt.getCurrentTime?.() ?? currentTime)
                          : currentTime;
                      if (lines?.length) {
                        let activeIdx = -1;
                        for (let i = 0; i < lines.length; i++) {
                          if (lines[i].timestamp != null && lines[i].timestamp <= now) activeIdx = i;
                        }
                        if (activeIdx >= 0) {
                          const activeLine = lines[activeIdx];
                          const a = activeLine.timestamp;
                          let b = activeLine.endTime ?? null;
                          if (b == null) {
                            b = duration;
                            for (let i = activeIdx + 1; i < lines.length; i++) {
                              if (lines[i].timestamp != null) { b = lines[i].timestamp; break; }
                            }
                          }
                          setLoop(a, b);
                        }
                      }
                    }
                  }}
                  className={`rounded-full flex-shrink-0 ${loopA != null && loopB != null
                    ? 'bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                    }`}
                >
                  <Repeat className="w-4 h-4" />
                </Button>
              </Tip>

              <SpeedControl
                playbackSpeed={playbackSpeed}
                applySpeed={applySpeed}
                MIN_SPEED={MIN_SPEED}
                MAX_SPEED={MAX_SPEED}
                SPEED_PRESETS={SPEED_PRESETS}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─────────────── Compact mobile bar (hidden on desktop) ─────────────── */}
      <div className="lg:hidden border-t border-zinc-700/50 bg-zinc-900/90 backdrop-blur-md">
        {/* No media */}
        {!hasMedia && (
          <div className="flex flex-col gap-1 px-3 py-2">
            {(yt.ytLoading || sp.loading) ? (
              <div className="flex items-center gap-3 flex-1 py-2">
                <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm text-zinc-400">{t('player.loading') || 'Loading…'}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="audio-file-compact"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-sm font-medium text-zinc-300 cursor-pointer active:scale-95 transition-transform shrink-0"
                  >
                    <FolderOpen className="w-4 h-4" />
                    {t('player.dropAudio') || 'Load audio'}
                    <input id="audio-file-compact" type="file" accept="audio/*" onChange={local.handleFileChange} className="hidden" />
                  </label>
                  <div className="flex flex-1 gap-2">
                    <Input
                      type="text"
                      value={yt.ytUrl}
                      onChange={(e) => { yt.setYtUrl(e.target.value); yt.setYtError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && yt.loadYouTube()}
                      placeholder={t('player.pasteUrl') || 'YouTube URL'}
                      className="flex-1 h-9 bg-zinc-800/60 text-zinc-100 placeholder-zinc-500 border-zinc-700 text-xs"
                    />
                    <Button onClick={yt.loadYouTube} className="px-3 h-9 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg shrink-0">
                      {t('player.load') || 'Load'}
                    </Button>
                  </div>
                </div>
                {getAccessToken() && (
                  <Popover onOpenChange={(open) => { if (open) fetchUploads(); }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-700/60 text-zinc-300 text-xs h-8"
                      >
                        <span className="flex items-center gap-1.5">
                          <Cloud className="w-3 h-3 text-zinc-500" />
                          {t('uploads.selectFromUploads')}
                        </span>
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[180px] overflow-y-auto p-1" align="start">
                      {mediaUploads.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-3">{t('uploads.empty')}</p>
                      ) : (
                        mediaUploads.map((upload) => (
                          <button
                            key={upload.id}
                            onClick={() => handleSelectUpload(upload)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-zinc-700/60 transition-colors"
                          >
                            <div className="w-8 h-8 rounded flex-shrink-0 overflow-hidden bg-zinc-700/50 flex items-center justify-center">
                              {upload.thumbnailUrl ? (
                                <img
                                  src={upload.thumbnailUrl}
                                  alt={upload.title || 'Thumbnail'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                              ) : null}
                              <div className={upload.thumbnailUrl ? 'hidden' : 'flex'} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                {upload.source === 'youtube'
                                  ? <Video className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  : upload.source === 'spotify'
                                    ? <SpotifyIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                    : <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                              </div>
                            </div>
                            <span className="text-xs font-medium text-zinc-200 truncate">
                              {upload.title || upload.fileName || upload.youtubeUrl || t('uploads.untitled')}
                            </span>
                          </button>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                )}
                {getAccessToken() && (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      onClick={() => setShowSpotifyBrowser(true)}
                      className="flex-1 justify-between bg-green-500/10 border-green-500/20 hover:bg-green-500/20 text-green-400 text-xs h-8"
                    >
                      <span className="flex items-center gap-1.5">
                        <SpotifyIcon className="w-3 h-3" />
                        {t('spotify.browseLibrary')}
                      </span>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSyncNowPlaying}
                      disabled={syncingNowPlaying}
                      className="bg-green-500/10 border-green-500/20 hover:bg-green-500/20 text-green-400 text-xs h-8 px-2 disabled:opacity-50"
                    >
                      <Headphones className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Has media: seekbar row + action row */}
        {hasMedia && (
          <>
            {/* Row 1 — seekbar (h-10) */}
            <div className="flex items-center gap-2 px-3 h-10">
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
              >
                {isPlaying
                  ? <Pause className="w-3.5 h-3.5 text-zinc-950" fill="currentColor" />
                  : <Play className="w-3.5 h-3.5 text-zinc-950 ml-0.5" fill="currentColor" />}
              </button>
              <span className="text-[10px] font-mono tabular-nums text-zinc-400 w-10 shrink-0 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 relative min-w-0">
                {loopA != null && loopB != null && duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-accent-purple/15 border-x border-accent-purple/40 rounded-sm pointer-events-none z-base"
                    style={{
                      left: `${(loopA / duration) * 100}%`,
                      width: `${((loopB - loopA) / duration) * 100}%`,
                    }}
                  />
                )}
                <input
                  type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
                  aria-label="Seek" aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  className="w-full relative z-raised"
                  style={{ background: `linear-gradient(to right, var(--color-primary) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255, 255, 255, 0.15) ${duration ? (currentTime / duration) * 100 : 0}%)` }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-zinc-400 w-10 shrink-0">
                {formatTime(duration)}
              </span>
              <SpeedControl playbackSpeed={playbackSpeed} applySpeed={applySpeed} MIN_SPEED={MIN_SPEED} MAX_SPEED={MAX_SPEED} SPEED_PRESETS={SPEED_PRESETS} />
            </div>

            {/* Row 2 — finger-friendly action buttons (h-12) */}
            <div className="flex items-center justify-evenly h-12 border-t border-zinc-800/40">
              <button
                onClick={() => seek(Math.max(0, currentTime - (settings.playback?.seekTime ?? 5)))}
                aria-label={`Skip back ${settings.playback?.seekTime ?? 5} seconds`}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl text-zinc-400 active:text-zinc-100 active:bg-zinc-800/60 transition-all"
              >
                <SkipBack className="w-5 h-5" />
                <span className="text-[8px] font-bold leading-none mt-0.5">{settings.playback?.seekTime ?? 5}</span>
              </button>

              <button
                onClick={() => {
                  if (loopA != null && loopB != null) {
                    clearLoop();
                  } else {
                    const now = source === 'local' ? (audioRef.current?.currentTime ?? currentTime) : source === 'youtube' ? (yt.getCurrentTime?.() ?? currentTime) : currentTime;
                    if (lines?.length) {
                      let activeIdx = -1;
                      for (let i = 0; i < lines.length; i++) {
                        if (lines[i].timestamp != null && lines[i].timestamp <= now) activeIdx = i;
                      }
                      if (activeIdx >= 0) {
                        const a = lines[activeIdx].timestamp;
                        let b = lines[activeIdx].endTime ?? null;
                        if (b == null) {
                          b = duration;
                          for (let i = activeIdx + 1; i < lines.length; i++) {
                            if (lines[i].timestamp != null) { b = lines[i].timestamp; break; }
                          }
                        }
                        setLoop(a, b);
                      }
                    }
                  }
                }}
                aria-label={loopA != null && loopB != null ? 'Clear A-B loop' : 'Set A-B loop'}
                className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all ${loopA != null && loopB != null ? 'text-accent-purple bg-accent-purple/10' : 'text-zinc-400 active:text-zinc-100 active:bg-zinc-800/60'}`}
              >
                <Repeat className="w-5 h-5" />
              </button>

              <VolumeControl />

              <button
                onClick={() => seek(Math.min(duration, currentTime + (settings.playback?.seekTime ?? 5)))}
                aria-label={`Skip forward ${settings.playback?.seekTime ?? 5} seconds`}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl text-zinc-400 active:text-zinc-100 active:bg-zinc-800/60 transition-all"
              >
                <SkipForward className="w-5 h-5" />
                <span className="text-[8px] font-bold leading-none mt-0.5">{settings.playback?.seekTime ?? 5}</span>
              </button>

              {syncMode && (
                <button
                  onPointerDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('editor:mark')); }}
                  aria-label="Mark timestamp"
                  className="flex flex-col items-center justify-center w-12 h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary active:bg-primary/25 active:scale-95 transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile Spotify Browser overlay */}
      {showSpotifyBrowser && (
        <div className="lg:hidden fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-green-400 flex items-center gap-2">
              <SpotifyIcon className="w-4 h-4" />
              {t('spotify.browse')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSpotifyBrowser(false)}
              className="text-zinc-400 hover:text-zinc-200 h-7 px-2 text-xs"
            >
              ✕
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SpotifyBrowser
              onSelectTrack={handleSpotifyBrowserSelect}
              onClose={() => setShowSpotifyBrowser(false)}
            />
          </div>
        </div>
      )}

      {confirmModal}
    </>
  );
});

export default Player;
