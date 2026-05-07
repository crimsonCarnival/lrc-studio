import { useState, useRef, useCallback, useEffect } from 'react';
import { spotify as spotifyApi } from '@/api';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const POLL_INTERVAL = 200; // ms

let sdkLoadPromise = null;

function loadSpotifySdk() {
  if (sdkLoadPromise) return sdkLoadPromise;
  if (window.Spotify) return Promise.resolve();
  sdkLoadPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export default function useSpotifyPlayer({
  updateTime,
  updateDuration,
  setIsPlaying,
  setCurrentTime,
  setSource,
  onTitleChange,
  onMediaChange,
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackId, setTrackId] = useState(null);

  const playerRef = useRef(null);
  const deviceIdRef = useRef(null);
  const pollRef = useRef(null);
  const durationRef = useRef(0);

  // ——— Cleanup ———
  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    deviceIdRef.current = null;
    setReady(false);
    setTrackId(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ——— Initialize player & play a track ———
  const playTrack = useCallback(async (spotifyTrackId, title, autoPlay = true) => {
    setError('');
    setLoading(true);
    setSource('spotify');

    try {
      await loadSpotifySdk();

      // If already connected, reuse. Otherwise create a new player.
      if (!playerRef.current) {
        const player = new window.Spotify.Player({
          name: 'LRC Studio',
          getOAuthToken: async (cb) => {
            try {
              const { accessToken } = await spotifyApi.getToken();
              cb(accessToken);
            } catch {
              setError('Failed to get Spotify token');
              cb('');
            }
          },
          volume: 0.5,
        });

        player.addListener('ready', ({ device_id }) => {
          deviceIdRef.current = device_id;
        });

        player.addListener('not_ready', () => {
          deviceIdRef.current = null;
          setReady(false);
        });

        player.addListener('player_state_changed', (state) => {
          if (!state) return;
          const { paused, position, duration } = state;
          setIsPlaying(!paused);
          setCurrentTime(position / 1000);
          updateTime(position / 1000);
          if (duration && duration !== durationRef.current) {
            durationRef.current = duration;
            updateDuration(duration / 1000);
          }
        });

        player.addListener('initialization_error', ({ message }) => setError(message));
        player.addListener('authentication_error', ({ message }) => setError(message));
        player.addListener('account_error', ({ message }) => setError(message || 'Spotify Premium required'));

        const connected = await player.connect();
        if (!connected) {
          setLoading(false);
          setError('Failed to connect to Spotify');
          return;
        }

        playerRef.current = player;

        // Wait for device to be ready (up to 5s)
        await new Promise((resolve, reject) => {
          let waited = 0;
          const check = setInterval(() => {
            if (deviceIdRef.current) { clearInterval(check); resolve(); }
            waited += 100;
            if (waited >= 5000) { clearInterval(check); reject(new Error('Spotify device timed out')); }
          }, 100);
        });
      }

      // Transfer playback and start the track
      const { accessToken } = await spotifyApi.getToken();
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceIdRef.current)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
      });

      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || `Playback failed: ${res.status}`);
      }

      // If autoPlay is false, pause immediately
      if (!autoPlay) {
        // Wait for track to start loading, then pause
        await new Promise(resolve => setTimeout(resolve, 800));
        try {
          await playerRef.current?.pause();
          // Ensure it's actually paused by checking state
          const state = await playerRef.current?.getCurrentState?.();
          if (state && !state.paused) {
            // Try pausing again if still playing
            await new Promise(resolve => setTimeout(resolve, 200));
            await playerRef.current?.pause();
          }
        } catch (err) {
          console.warn('Failed to pause after loading:', err);
        }
      }

      setTrackId(spotifyTrackId);
      if (title) onTitleChange?.(title);
      onMediaChange?.(true);
      setReady(true);

      // Start position polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState?.();
        if (state) {
          updateTime(state.position / 1000);
          if (state.duration && state.duration !== durationRef.current) {
            durationRef.current = state.duration;
            updateDuration(state.duration / 1000);
          }
        }
      }, POLL_INTERVAL);
    } catch (err) {
      setError(err.message || 'Spotify playback failed');
    } finally {
      setLoading(false);
    }
  }, [setSource, setIsPlaying, setCurrentTime, updateTime, updateDuration, onTitleChange, onMediaChange]);

  // ——— Playback controls ———
  const play = useCallback(() => playerRef.current?.resume(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);

  const seek = useCallback((timeSeconds) => {
    playerRef.current?.seek(Math.round(timeSeconds * 1000));
    setCurrentTime(timeSeconds);
    updateTime(timeSeconds);
  }, [setCurrentTime, updateTime]);

  const setSpeed = useCallback(() => {
    // Web Playback SDK does not support speed control
  }, []);

  const setVolume = useCallback((vol) => {
    playerRef.current?.setVolume(vol);
  }, []);

  const getCurrentTime = useCallback(() => {
    // Return last known position — for instant reads use the polled value
    return 0; // will be overridden by state updates
  }, []);

  const remove = useCallback(() => {
    cleanup();
    onTitleChange?.('');
    onMediaChange?.(false);
  }, [cleanup, onTitleChange, onMediaChange]);

  return {
    ready,
    error,
    loading,
    trackId,
    playTrack,
    play,
    pause,
    seek,
    setSpeed,
    setVolume,
    getCurrentTime,
    remove,
  };
}
