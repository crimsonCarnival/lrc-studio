import { useState, useRef, useCallback, useEffect } from 'react';
import { extractVideoId } from './playerService';

// Module-level WeakMap: stores raw YouTube player objects outside React's
// tracking system so React DevTools never walks the cross-origin iframe.
const ytPlayerStore = new WeakMap();

export default function useYouTubePlayer({
  containerRef,
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
}) {
  // useRef gives a stable identity ESLint recognises as safe in dep arrays.
  // On first render we redefine `current` as a non-enumerable WeakMap-backed
  // accessor so React DevTools' property-walker never reaches the raw YT player
  // object (which would throw a cross-origin SecurityError).
  const ytPlayerRef = useRef(null);
  const _ytRefInitialized = useRef(false);
  if (!_ytRefInitialized.current) {
    _ytRefInitialized.current = true;
    const _ref = ytPlayerRef; // capture stable reference for the closure
    Object.defineProperty(ytPlayerRef, 'current', {
      enumerable: false, // hidden from DevTools enumeration
      configurable: true,
      get: () => {
        const raw = ytPlayerStore.get(_ref) ?? null;
        if (!raw) return null;
        // Wrap in a Proxy so React DevTools can never walk into the YT player's
        // cross-origin iframe properties (e.g. contentWindow) that throw SecurityError.
        // ownKeys/getOwnPropertyDescriptor return nothing → DevTools sees an opaque
        // object and stops; our own code still reaches all API methods via the get trap.
        return new Proxy(raw, {
          get(target, prop) {
            try {
              const val = target[prop];
              return typeof val === 'function' ? val.bind(target) : val;
            } catch {
              return undefined;
            }
          },
          ownKeys() { return []; },
          getOwnPropertyDescriptor() { return undefined; },
          getPrototypeOf() { return null; },
          has() { return false; },
        });
      },
      set: (v) => { if (v == null) ytPlayerStore.delete(_ref); else ytPlayerStore.set(_ref, v); },
    });
  }
  const ytInnerRef = useRef(null);
  const rafIdRef = useRef(null);
  const apiLoadedRef = useRef(false);
  const onYtUrlChangeRef = useRef(onYtUrlChange);
  useEffect(() => { onYtUrlChangeRef.current = onYtUrlChange; }, [onYtUrlChange]);

  const [ytUrl, setYtUrl] = useState(initialYtUrl || '');
  const [ytReady, setYtReady] = useState(false);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');

  // Load YouTube IFrame API
  useEffect(() => {
    if (apiLoadedRef.current) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      apiLoadedRef.current = true;
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      setYtError('Failed to load YouTube player. Check your connection or ad-blocker.');
    };
    document.head.appendChild(tag);
    apiLoadedRef.current = true;
    const timeout = setTimeout(() => {
      if (!window.YT) {
        setYtError('YouTube API took too long to load.');
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  // Create inner div for YT player on mount
  useEffect(() => {
    if (containerRef.current && !ytInnerRef.current) {
      const inner = document.createElement('div');
      inner.id = 'yt-player-inner';
      containerRef.current.appendChild(inner);
      ytInnerRef.current = inner;
    }
  }, [containerRef]);

  const loadYouTube = useCallback((urlOverride) => {
    const urlToLoad = (typeof urlOverride === 'string') ? urlOverride : ytUrl;
    const videoId = extractVideoId(urlToLoad);
    if (!videoId) {
      setYtError(t('player.invalidUrl') || 'Invalid YouTube URL');
      return;
    }
    setYtError('');
    setSource('youtube');
    setYtLoading(true);
    if (typeof urlOverride === 'string') setYtUrl(urlOverride);

    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const inner = document.createElement('div');
      inner.id = 'yt-player-inner';
      containerRef.current.appendChild(inner);
      ytInnerRef.current = inner;
    }

    setYtReady(false);
    setIsPlaying(false);
    setCurrentTime(0);

    const initPlayer = () => {
      if (!ytInnerRef.current) return;
      ytPlayerRef.current = new window.YT.Player(ytInnerRef.current, {
        videoId,
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (e) => {
            setYtReady(true);
            setYtLoading(false);
            const d = e.target.getDuration();
            updateDuration(d);
            e.target.setVolume(settings.playback.muted ? 0 : (settings.playback.volume * 100));
            const title = e.target.getVideoData()?.title;
            if (title) onTitleChange?.(title);
            onMediaChange?.(true);
            onYtUrlChangeRef.current?.(urlToLoad);
          },
          onStateChange: (e) => {
            const playing = e.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            if (e.data === window.YT.PlayerState.PAUSED && settings.playback?.autoRewindOnPause?.enabled) {
              const current = ytPlayerRef.current.getCurrentTime();
              const dur = ytPlayerRef.current.getDuration();
              if (current > 0 && current < dur) {
                const newTime = Math.max(0, current - (settings.playback?.autoRewindOnPause?.seconds || 2));
                ytPlayerRef.current.seekTo(newTime, true);
                updateTime(newTime);
              }
            }
          },
          onError: (e) => {
            const errorCodes = {
              2: 'Invalid video ID',
              5: 'HTML5 player error',
              100: 'Video not found or private',
              101: 'Video cannot be embedded',
              150: 'Video cannot be embedded',
            };
            setYtError(errorCodes[e.data] || `YouTube error (code ${e.data})`);
            setYtLoading(false);
            setYtReady(false);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [containerRef, ytUrl, t, settings.playback.volume, settings.playback.muted, settings.playback.autoRewindOnPause?.enabled, settings.playback.autoRewindOnPause?.seconds, updateDuration, updateTime, setIsPlaying, setCurrentTime, onTitleChange, onMediaChange, setSource]);

  // Auto-load when initialYtUrl is provided (e.g., project restore)
  const autoLoadedFromInitialRef = useRef(false);
  useEffect(() => {
    if (initialYtUrl && !autoLoadedFromInitialRef.current) {
      autoLoadedFromInitialRef.current = true;
      loadYouTube(initialYtUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialYtUrl]);

  // Poll YouTube time with requestAnimationFrame
  useEffect(() => {
    if (!ytReady || !isPlaying) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      return;
    }

    let lastPoll = 0;
    const poll = (timestamp) => {
      if (timestamp - lastPoll >= 50) {
        lastPoll = timestamp;
        if (ytPlayerRef.current?.getCurrentTime) {
          updateTime(ytPlayerRef.current.getCurrentTime());
        }
      }
      rafIdRef.current = requestAnimationFrame(poll);
    };
    rafIdRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [ytReady, isPlaying, updateTime]);

  const remove = useCallback(() => {
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const inner = document.createElement('div');
      inner.id = 'yt-player-inner';
      containerRef.current.appendChild(inner);
      ytInnerRef.current = inner;
    }
    setYtReady(false);
    setYtLoading(false);
    setYtUrl('');
    setYtError('');
    setSource('local');
    onYtUrlChangeRef.current?.('');
  }, [containerRef, setSource]);

  const play = useCallback(() => { ytPlayerRef.current?.playVideo(); }, []);
  const pause = useCallback(() => { ytPlayerRef.current?.pauseVideo(); }, []);

  const seek = useCallback((time) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(time, true);
      updateTime(time);
    }
  }, [updateTime]);

  const setSpeed = useCallback((speed) => {
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(speed);
    }
  }, []);

  const getCurrentTime = useCallback(() => ytPlayerRef.current?.getCurrentTime?.() || 0, []);

  // Sync volume when settings change
  useEffect(() => {
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(settings.playback.muted ? 0 : (settings.playback.volume * 100));
    }
  }, [settings.playback.volume, settings.playback.muted, ytReady]);

  return {
    ytUrl,
    setYtUrl,
    ytReady,
    ytLoading,
    ytError,
    setYtError,
    loadYouTube,
    remove,
    play,
    pause,
    seek,
    setSpeed,
    getCurrentTime,
  };
}
