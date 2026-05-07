import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/useSettings';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

import { formatTime } from '@/utils/formatTime';
import useLocalAudio from './useLocalAudio';
import useYouTubePlayer from './useYouTubePlayer';
import useSpotifyPlayer from './useSpotifyPlayer';
import SpotifyBrowser from './SpotifyBrowser';
import WaveformDisplay from './WaveformDisplay';
import PlaybackProgress from './PlaybackProgress';
import VolumeControl from './VolumeControl';
import SpeedControl from './SpeedControl';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@ui/popover';
import { Music2, AlertTriangle, Play, Pause, Headphones, FolderOpen, Repeat, SkipBack, SkipForward, Cloud, Video, ChevronDown, Link2, PanelTop, PanelBottom, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tip } from '@ui/tip';
import { uploads as uploadsApi, spotify as spotifyApi, getAccessToken } from '@/api';
import SpotifyIcon from '@shared/SpotifyIcon';
import toast from 'react-hot-toast';

const ALL_SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

const Player = forwardRef(function Player(
  { onTimeUpdate, onPlayingChange, onSpeedChange, onDurationChange, onMediaChange, playerRef: _legacyRef, mediaTitle, onTitleChange, initialYtUrl, initialCloudinaryUpload, onYtUrlChange, initialSeek, initialSpeed, lines, activeLineIndex, playbackPosition, syncMode = false, onCloudinaryUpload, playerTop = false, onDockToggle, onSpotifyTrackIdChange },
  ref,
) {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();

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
  const [playbackSpeed, setPlaybackSpeedRaw] = useState(() => {
    const s = parseFloat(initialSpeed);
    return (isFinite(s) && s > 0) ? s : 1;
  });

  const setPlaybackSpeed = useCallback((s) => {
    setPlaybackSpeedRaw(s);
    onSpeedChange?.(s);
  }, [onSpeedChange]);

  const [isPlaying, setIsPlayingRaw] = useState(false);
  const setIsPlaying = useCallback((p) => {
    setIsPlayingRaw(p);
    onPlayingChange?.(p);
  }, [onPlayingChange]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaUploads, setMediaUploads] = useState([]);

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
      const uploads = await uploadsApi.listMedia();
      setMediaUploads(uploads || []);
    } catch { /* ignore */ }
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

  // Sync A-B loop with current line if loopCurrentLine is enabled
  useEffect(() => {
    if (settings.playback?.loopCurrentLine && lines?.[activeLineIndex] && lines[activeLineIndex].timestamp != null) {
      const currentLine = lines[activeLineIndex];
      const a = currentLine.timestamp;
      let b = currentLine.endTime ?? null;
      if (b == null) {
        const nextLine = lines.slice(activeLineIndex + 1).find(l => l.timestamp != null);
        b = nextLine ? nextLine.timestamp : duration;
      }
      setLoopA(a);
      setLoopB(b);
    } else if (!settings.playback?.loopCurrentLine) {
      // Only clear if it was an auto-loop. For simplicity, we'll just clear it when disabled.
      setLoopA(null);
      setLoopB(null);
    }
  }, [settings.playback?.loopCurrentLine, activeLineIndex, lines, duration]);

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
    initialSeek,
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
    sp.playTrack(track.id, track.name, false);
    onTitleChange?.(track.name);
    setShowSpotifyBrowser(false);
  }, [sp, onTitleChange]);

  const { login: handleSpotifyLogin } = useSpotifyAuth();

  const handleSpotifyLoad = () => {
    const trimmed = spotifyUrl.trim();
    if (!trimmed.includes('spotify.com/track/') && !trimmed.startsWith('spotify:track:')) {
      setSpotifyError(t('spotify.invalidUrl') || 'Invalid Spotify track URL');
      return;
    }
    spotifyApi.createUpload(trimmed).then((result) => {
      sp.playTrack(result.spotifyTrackId || result.trackMeta?.trackId, result.title || result.trackMeta?.name || '', false);
      onTitleChange?.(result.title || result.trackMeta?.name || '');
      setSpotifyUrl('');
    }).catch((err) => setSpotifyError(err.message || 'Invalid Spotify URL'));
  };

  // ——— CDN URL handling ———
  // Matches Cloudinary CDN URLs
  const CDN_PATTERN = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//;
  // Matches any generic HTTPS audio URL (fallback)
  const AUDIO_URL_PATTERN = /^https?:\/\/.+\.(mp3|mp4|wav|ogg|flac|aac|m4a|webm)(\?.*)?$/i;
  const YT_PATTERN = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?.+&v=)|youtu\.be\/)([^&?/\s]{11})/;

  const detectedUrlType = (() => {
    const v = yt.ytUrl.trim().split(/\s+/)[0];
    if (!v) return 'none';
    if (CDN_PATTERN.test(v)) return 'cdn';
    if (AUDIO_URL_PATTERN.test(v)) return 'cdn'; // treat any direct audio URL the same
    if (YT_PATTERN.test(v) || v.length === 11) return 'youtube';
    return 'unknown';
  })();

  const [cdnLoading, setCdnLoading] = useState(false);

  const handleCdnUrlLoad = useCallback(async (url) => {
    // Extract filename from URL path (strip query string)
    const cleanUrl = url.split(/\s+/)[0];
    const pathOnly = cleanUrl.split('?')[0].split('#')[0];
    const lastSegment = pathOnly.split('/').pop() || 'audio';
    const dotIdx = lastSegment.lastIndexOf('.');
    const rawName = dotIdx > 0 ? lastSegment.slice(0, dotIdx) : lastSegment;
    const ext = dotIdx > 0 ? lastSegment.slice(dotIdx + 1).toLowerCase() : 'mp4';
    const fileName = `${rawName}.${ext}`;
    // Use rawName as display title (avoid showing hash-like IDs)
    const title = rawName.length > 30 ? 'Cloud Audio' : rawName;

    local.loadFromUrl(cleanUrl, title);
    yt.setYtError('');

    if (getAccessToken()) {
      setCdnLoading(true);
      try {
        const { upload } = await uploadsApi.saveMedia({
          source: 'cloudinary',
          cloudinaryUrl: cleanUrl,
          fileName,
          title,
          duration: null,
        });
        onCloudinaryUpload?.({
          id: upload.id,
          cloudinaryUrl: cleanUrl,
          publicId: null,
          fileName,
          duration: null,
        });
      } catch (err) {
        console.error('Failed to save CDN upload:', err);
        toast.error('Failed to save media reference');
      } finally {
        setCdnLoading(false);
      }
    }
  }, [local, onCloudinaryUpload, yt]);

  const handleUrlLoad = useCallback(() => {
    const trimmed = yt.ytUrl.trim().split(/\s+/)[0];
    if (!trimmed) return;
    if (detectedUrlType === 'cdn') {
      handleCdnUrlLoad(trimmed);
      return;
    }
    const videoId = trimmed.match(YT_PATTERN)?.[1] || (trimmed.length === 11 ? trimmed : null);
    if (videoId) {
      yt.setYtError('');
      yt.loadYouTube();
      return;
    }
    yt.setYtError(t('player.invalidUrl') || 'Invalid URL. Paste a YouTube or Cloudinary CDN URL.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt, detectedUrlType, handleCdnUrlLoad, t]);

  const [syncingNowPlaying, setSyncingNowPlaying] = useState(false);
  const handleSyncNowPlaying = useCallback(async () => {
    setSyncingNowPlaying(true);
    try {
      const data = await spotifyApi.getCurrentlyPlaying();
      if (data?.track?.trackId) {
        sp.playTrack(data.track.trackId, data.track.name || '');
        onSpotifyTrackIdChange?.(data.track.trackId);
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
      onSpotifyTrackIdChange?.(upload.spotifyTrackId);
      onTitleChange?.(upload.title || upload.artist || '');
    } else if (upload.source === 'cloudinary' && upload.cloudinaryUrl) {
      fetch(upload.cloudinaryUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], upload.fileName || 'audio.mp3', { type: blob.type || 'audio/mpeg' });
          file.isCloudinary = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    [source, MIN_SPEED, MAX_SPEED, local, yt, setPlaybackSpeed],
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
      loadFromUrl: (url, title) => local.loadFromUrl(url, title),
      loadSpotify: (trackId, title, autoPlay = false) => sp.playTrack(trackId, title, autoPlay),
      setLoop,
      clearLoop,
      getLoop: () => ({ a: loopA, b: loopB }),
    }),
    [source, isPlaying, togglePlay, seek, local, yt, sp, applySpeed, playbackSpeed, setLoop, clearLoop, loopA, loopB],
  );

  // ——— Apply restored seek/speed once after media is ready ———
  const restoredValuesAppliedRef = useRef(false);
  useEffect(() => {
    if (hasMedia && !restoredValuesAppliedRef.current) {
      restoredValuesAppliedRef.current = true;
      if (initialSeek > 0) {
        seek(initialSeek);
      }
      if (initialSpeed && initialSpeed !== 1) {
        applySpeed(initialSpeed);
      }
      // Ensure the player doesn't autoplay after restoring position
      if (source === 'youtube') yt.pause();
      else if (source === 'local') local.pause();
    }
  }, [hasMedia, initialSeek, initialSpeed, seek, applySpeed, source, yt, local]);

  // ——— Auto-load initial Cloudinary media ———
  const loadedCloudinaryRef = useRef(null);
  useEffect(() => {
    if (initialCloudinaryUpload?.id && loadedCloudinaryRef.current !== initialCloudinaryUpload.id) {
      loadedCloudinaryRef.current = initialCloudinaryUpload.id;

      // Directly stream the URL instead of downloading a full blob
      local.loadFromUrl(initialCloudinaryUpload.cloudinaryUrl, initialCloudinaryUpload.title || initialCloudinaryUpload.fileName);

      // Pre-set the Cloudinary info in state so it knows it's linked
      onCloudinaryUpload?.({
        id: initialCloudinaryUpload.id,
        cloudinaryUrl: initialCloudinaryUpload.cloudinaryUrl,
        publicId: initialCloudinaryUpload.publicId,
        fileName: initialCloudinaryUpload.fileName,
        duration: initialCloudinaryUpload.duration,
      });
    }
  }, [initialCloudinaryUpload, local, onCloudinaryUpload]);


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

      {/* ─────────────── Desktop full bar content (hidden on mobile) ─────────────── */}
      <div className="max-lg:hidden animate-fade-in overflow-visible flex flex-col items-center w-full">
        {/* Header */}
        {!hasMedia && (
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-4 mb-2">
            <h2 className="text-xs sm:text-sm font-semibold tracking-widest text-zinc-400 flex items-center gap-2 overflow-hidden pb-0.5 min-w-0">
              <span className="uppercase shrink-0 text-xs sm:text-sm flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" />{t('player.title')}</span>
              {mediaTitle && (
                <div className="flex items-center gap-2 px-1.5 py-0.5 rounded text-xs min-w-0">
                  <Music2 className="w-2.5 h-2.5 text-primary shrink-0" strokeWidth={2.5} />
                  <span className="text-primary normal-case tracking-normal truncate max-w-[300px]">{mediaTitle}</span>
                </div>
              )}
            </h2>
          </div>
        )}

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
        {/* Compact unified media loader for docked bar */}
        {!hasMedia && !yt.ytLoading && !sp.loading && (
          <div className="animate-fade-in w-full max-w-[1000px] mx-auto flex items-center justify-center gap-3">
            {/* Local Audio */}
            <label
              htmlFor="audio-file-input"
              className="flex items-center gap-2 px-4 py-2 h-10 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-primary/40 transition-all cursor-pointer shadow-sm group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) local.handleFileChange({ target: { files: [file] } });
              }}
            >
              <FolderOpen className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{t('player.dropAudio')}</span>
              <input id="audio-file-input" type="file" accept="audio/*" onChange={local.handleFileChange} className="hidden" />
            </label>

            <div className="w-px h-6 bg-zinc-800/80 mx-1" />

            {/* URL Input (YouTube/CDN/Spotify) */}
            <div className="flex items-center gap-2 flex-1 max-w-[450px]">
              <div className="relative w-full">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <Input
                  value={yt.ytUrl || spotifyUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('spotify')) {
                      setSpotifyUrl(val);
                      yt.setYtUrl('');
                    } else {
                      yt.setYtUrl(val);
                      setSpotifyUrl('');
                    }
                    yt.setYtError('');
                    setSpotifyError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (spotifyUrl) handleSpotifyLoad();
                      else handleUrlLoad();
                    }
                  }}
                  placeholder={t('player.pasteUrl') || "Paste YouTube, Spotify, or CDN URL..."}
                  className="pl-8 pr-16 bg-zinc-900/50 border-zinc-700/50 text-sm h-10 rounded-xl shadow-inner w-full"
                />
                
                {/* Spotify Quick Actions */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <Tip content={getAccessToken() ? t('spotify.browse') : t('spotify.authRequired')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => getAccessToken() ? setShowSpotifyBrowser(true) : handleSpotifyLogin()}
                      className="w-8 h-8 rounded-lg text-zinc-500 hover:text-green-500 hover:bg-green-500/10"
                    >
                      <SpotifyIcon className={`w-4 h-4 ${!getAccessToken() ? 'opacity-40 grayscale' : ''}`} />
                    </Button>
                  </Tip>
                  <Tip content={getAccessToken() ? t('spotify.syncNowPlaying') : t('spotify.authRequired')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!getAccessToken() || syncingNowPlaying}
                      onClick={handleSyncNowPlaying}
                      className="w-8 h-8 rounded-lg text-zinc-500 hover:text-green-500 hover:bg-green-500/10 disabled:opacity-30"
                    >
                      <Headphones className={`w-3.5 h-3.5 ${syncingNowPlaying ? 'animate-pulse text-green-500' : ''}`} />
                    </Button>
                  </Tip>
                </div>
              </div>
              <Button
                onClick={() => {
                  if (spotifyUrl) handleSpotifyLoad();
                  else handleUrlLoad();
                }}
                disabled={cdnLoading}
                className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 font-medium shrink-0"
              >
                {cdnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('player.load')}
              </Button>
            </div>

            {getAccessToken() && (
              <>
                <div className="w-px h-6 bg-zinc-800/80 mx-1" />
                <Popover onOpenChange={(open) => { if (open) fetchUploads(); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/30 hover:border-zinc-700 transition-all text-zinc-300"
                    >
                      <Cloud className="w-4 h-4 text-blue-400/80" />
                      <span className="text-sm font-medium">{t('uploads.title')}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] max-h-[300px] overflow-y-auto p-1 glass-dark border-zinc-700/50 shadow-2xl" align="end" sideOffset={12}>
                    {mediaUploads.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">{t('uploads.empty')}</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1">
                        {mediaUploads.map((upload) => (
                          <button
                            key={upload.id}
                            onClick={() => handleSelectUpload(upload)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-800/80 transition-all group"
                          >
                            <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 group-hover:border-primary/40 flex items-center justify-center shrink-0">
                              {upload.source === 'youtube'
                                ? <Video className="w-3.5 h-3.5 text-red-400" />
                                : upload.source === 'spotify'
                                  ? <SpotifyIcon className="w-3.5 h-3.5 text-green-400" />
                                  : <Cloud className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-primary transition-colors">
                                {upload.title || upload.fileName || upload.youtubeUrl || t('uploads.untitled')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </>
            )}
            
            {/* Show error if any below the compact bar absolutely */}
            {(yt.ytError || spotifyError) && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded">
                {yt.ytError || spotifyError}
              </div>
            )}
          </div>
        )}

        {/* Local audio waveform */}
        {source === 'local' && local.localUrl && (
          <div className="animate-fade-in w-full max-w-[1200px] mx-auto">
            <WaveformDisplay
              showWaveform={settings.playback?.showWaveform}
              audioRef={audioRef}
              localUrl={local.localUrl}
              lines={lines}
              playbackPosition={playbackPosition}
              duration={duration}
              onSeek={seek}
              loopA={loopA}
              loopB={loopB}
              onLoopChange={(a, b) => { setLoopA(a); setLoopB(b); }}
            />
          </div>
        )}

        {source !== 'local' && hasMedia && (
          <div className="animate-fade-in w-full max-w-[1200px] mx-auto px-4">
            <PlaybackProgress
              playbackPosition={playbackPosition}
              duration={duration}
              onSeek={seek}
              loopA={loopA}
              loopB={loopB}
              onLoopChange={(a, b) => { setLoopA(a); setLoopB(b); }}
            />
          </div>
        )}

        {(local.localUrl || yt.ytReady || sp.ready) && (
          <div className="animate-fade-in w-full max-w-[1200px] mx-auto">
            <div className="flex items-center justify-between gap-3 w-full relative min-h-[48px] pb-1.5 lg:pb-2">

               {/* ── Left: Dock Toggle ── */}
               <div className="flex items-center gap-2 z-10">
                    <Tip content={playerTop ? (t('player.moveToBottom') || 'Move to bottom') : (t('player.moveToTop') || 'Move to top')}>
                      <Button
                        id="dock-toggle-btn"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDockToggle?.()}
                        className="shrink-0 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
                      >
                        {playerTop ? <PanelBottom className="w-4 h-4" /> : <PanelTop className="w-4 h-4" />}
                      </Button>
                    </Tip>
               </div>
 
               {/* ── CENTERED: Transport Cluster (Times + Speed + Nudges + Play + Volume) ── */}
               <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-4 z-20">
                 {/* Current Time on the left */}
                 <span className="text-xs text-zinc-400 font-mono tabular-nums shrink-0 min-w-[44px] text-right">
                   {formatTime(currentTime)}
                 </span>

                 <div className="w-px h-4 bg-zinc-800/60 shrink-0 mx-1" />

                 {/* Speed */}
                 <SpeedControl
                   playbackSpeed={playbackSpeed}
                   applySpeed={applySpeed}
                   MIN_SPEED={MIN_SPEED}
                   MAX_SPEED={MAX_SPEED}
                   SPEED_PRESETS={SPEED_PRESETS}
                 />

                 <div className="flex items-center gap-0.5 sm:gap-1.5">
                    <Tip content="-0.1s">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => seek(currentTime - 0.1)}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </Tip>

                    <Tip content={`-${settings.playback?.seekTime ?? 5}s`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => seek(Math.max(0, currentTime - (settings.playback?.seekTime ?? 5)))}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <SkipBack className="w-4 h-4" />
                      </Button>
                    </Tip>

                    <Button
                      id="play-pause-btn"
                      size="icon"
                      onClick={togglePlay}
                      aria-label={isPlaying ? t('shortcuts.playPause') || 'Pause' : t('shortcuts.playPause') || 'Play'}
                      className="rounded-full bg-primary hover:bg-primary-dim text-zinc-950 hover:scale-105 active:scale-95 glow-primary flex-shrink-0"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" fill="currentColor" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                      )}
                    </Button>

                    <Tip content={`+${settings.playback?.seekTime ?? 5}s`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => seek(Math.min(duration, currentTime + (settings.playback?.seekTime ?? 5)))}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </Tip>

                    <Tip content="+0.1s">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => seek(currentTime + 0.1)}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Tip>
                 </div>

                 {/* Volume */}
                 <VolumeControl />

                 <div className="w-px h-4 bg-zinc-800/60 shrink-0 mx-1" />

                 {/* Total Duration on the right */}
                 <span className="text-xs text-zinc-500 font-mono tabular-nums shrink-0 min-w-[44px]">
                   {formatTime(duration)}
                 </span>
               </div>
 
               {/* ── Right Section: Actions, Loop ── */}
               <div className="flex items-center gap-2 sm:gap-3 z-10">

 
                 {syncMode && (
                    <Tip content={t('player.mark') || 'Mark'}>
                      <Button
                        id="mark-btn"
                        variant="ghost"
                        size="icon"
                        onPointerDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('editor:mark')); }}
                        className="shrink-0 text-zinc-400 hover:text-primary hover:bg-primary/10"
                      >
                        <Bookmark className="w-4 h-4" />
                      </Button>
                    </Tip>
                 )}
 
<Tip content={settings.playback?.loopCurrentLine
                    ? (loopA != null && loopB != null)
                      ? `${t('player.loopActive')}: ${formatTime(loopA)} – ${formatTime(loopB)} · ${t('player.clickToDisable')}`
                      : t('player.setLoop')
                    : t('player.setLoop') || 'Loop current line'
                  }>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateSetting('playback.loopCurrentLine', !settings.playback?.loopCurrentLine)}
                        className={`rounded-full shrink-0 ${settings.playback?.loopCurrentLine
                          ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30'
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <Repeat className="w-4 h-4" />
                      </Button>
                    </Tip>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────── Compact mobile bar (hidden on desktop) ─────────────── */}
      <div className="lg:hidden w-full overflow-hidden">
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
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      {detectedUrlType === 'cdn' ? (
                        <Cloud className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400/80 pointer-events-none" />
                      ) : detectedUrlType === 'youtube' ? (
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-red-500/70 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      ) : (
                        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      )}
                      <Input
                        type="text"
                        value={yt.ytUrl}
                        onChange={(e) => { yt.setYtUrl(e.target.value); yt.setYtError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
                        placeholder="YouTube or CDN URL"
                        className="flex-1 h-9 pl-6 bg-zinc-800/60 text-zinc-100 placeholder-zinc-500 border-zinc-700 text-xs"
                      />
                    </div>
                    <Button
                      onClick={handleUrlLoad}
                      disabled={cdnLoading}
                      className={`px-3 h-9 text-white text-xs font-medium rounded-lg shrink-0 ${detectedUrlType === 'cdn' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'
                        }`}
                    >
                      {cdnLoading ? '…' : t('player.load')}
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
                              {upload.source === 'youtube'
                                ? <Video className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                : upload.source === 'spotify'
                                  ? <SpotifyIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  : <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
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
            <div className="flex flex-col gap-3 px-4 py-4 w-full">
              {/* Top Row: Play/Pause, Seeker, Speed */}
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform shadow-lg shadow-primary/20"
                >
                  {isPlaying
                    ? <Pause className="size-4 text-zinc-950" fill="currentColor" />
                    : <Play className="size-4 text-zinc-950 ml-0.5" fill="currentColor" />}
                </button>
                
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex-1 relative min-w-0 h-6 flex items-center">
                    {loopA != null && loopB != null && duration > 0 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent-purple/30 border-x border-accent-purple/50 rounded-sm pointer-events-none z-base"
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
                      className="w-full relative z-raised h-1 appearance-none bg-zinc-800 rounded-full outline-none"
                      style={{ background: `linear-gradient(to right, var(--color-primary) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255, 255, 255, 0.1) ${duration ? (currentTime / duration) * 100 : 0}%)` }}
                    />
                  </div>
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <SpeedControl playbackSpeed={playbackSpeed} applySpeed={applySpeed} MIN_SPEED={MIN_SPEED} MAX_SPEED={MAX_SPEED} SPEED_PRESETS={SPEED_PRESETS} />
                </div>
              </div>

              {/* Bottom Row: Secondary Controls */}
              <div className="flex items-center justify-between w-full gap-1 px-1">
                <button
                  onClick={() => seek(Math.max(0, currentTime - (settings.playback?.seekTime ?? 5)))}
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-zinc-400 active:text-zinc-100 active:bg-zinc-800 transition-all shrink-0"
                >
                  <SkipBack className="size-6" />
                  <span className="text-[10px] font-bold mt-1 text-zinc-500">{settings.playback?.seekTime ?? 5}</span>
                </button>

                <button
                  onClick={() => {
                    if (loopA != null && loopB != null) {
                      clearLoop();
                    } else {
                      const now = currentTime;
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
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all shrink-0 ${loopA != null && loopB != null ? 'text-accent-purple bg-accent-purple/10' : 'text-zinc-400 active:bg-zinc-800'}`}
                >
                  <Repeat className="size-6" />
                  <span className="text-[9px] font-bold mt-1 opacity-60 uppercase tracking-tight">{t('player.loop') || 'Loop'}</span>
                </button>

                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                  <VolumeControl />
                </div>

                <button
                  onClick={() => seek(Math.min(duration, currentTime + (settings.playback?.seekTime ?? 5)))}
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-zinc-400 active:text-zinc-100 active:bg-zinc-800 transition-all shrink-0"
                >
                  <SkipForward className="size-6" />
                  <span className="text-[10px] font-bold mt-1 text-zinc-500">{settings.playback?.seekTime ?? 5}</span>
                </button>

                {syncMode && (
                  <button
                    onPointerDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('editor:mark')); }}
                    className="w-14 h-14 rounded-3xl bg-primary/20 border border-primary/40 text-primary active:bg-primary/30 active:scale-95 transition-all flex items-center justify-center shrink-0"
                  >
                    <div className="size-4 rounded-full bg-current shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.6)]" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Spotify Browser Modal — Rendered in Portal to escape player container constraints */}
      {showSpotifyBrowser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 md:p-8 animate-fade-in">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xl transition-all duration-500" 
            onClick={() => setShowSpotifyBrowser(false)} 
          />
          
          {/* Modal Container */}
          <div className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-4xl bg-zinc-900 sm:border border-zinc-700/50 sm:rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in">
            {/* Glossy Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-inner">
                  <SpotifyIcon className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white tracking-tight">{t('spotify.browse')}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold opacity-60">Spotify Music Library</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSpotifyBrowser(false)}
                className="w-10 h-10 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-all group"
              >
                <div className="relative w-5 h-5">
                  <div className="absolute top-1/2 left-0 w-5 h-0.5 bg-current rotate-45 rounded-full" />
                  <div className="absolute top-1/2 left-0 w-5 h-0.5 bg-current -rotate-45 rounded-full" />
                </div>
              </Button>
            </div>
            
            {/* Browser Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-zinc-950/20">
              <SpotifyBrowser
                onSelectTrack={handleSpotifyBrowserSelect}
                onClose={() => setShowSpotifyBrowser(false)}
              />
            </div>
            
            {/* Mobile Footer */}
            <div className="sm:hidden p-4 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800">
               <Button 
                 onClick={() => setShowSpotifyBrowser(false)} 
                 className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl border border-zinc-700/50 shadow-lg active:scale-95 transition-all"
               >
                 {t('common.close') || 'Cerrar'}
               </Button>
            </div>
          </div>
        </div>,
        document.body
      )}


    </>
  );
});

export default Player;
