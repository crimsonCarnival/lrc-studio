import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { formatTime } from '@/utils/formatTime';

/**
 * Enhanced Waveform display with:
 * - Click/drag to seek
 * - Draggable playback line
 * - A-B loop region overlay with draggable handles
 * - Ruler with labelled tick marks
 */
const WaveformDisplay = ({
  showWaveform,
  audioRef,
  localUrl,
  lines,
  playbackPosition,
  duration,
  onSeek,
  loopA,
  loopB,
  onLoopChange,
}) => {
  const waveContainerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // ─── Seek on click/drag ───────────────────────────────────────────────────
  const isDraggingPlayhead = useRef(false);

  const pctToTime = useCallback((pct) => {
    return Math.max(0, Math.min(duration, pct * duration));
  }, [duration]);

  const clientXToPct = useCallback((clientX, rect) => {
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleWaveMouseDown = useCallback((e) => {
    if (!isReady || !duration || !waveContainerRef.current) return;
    isDraggingPlayhead.current = true;
    const rect = waveContainerRef.current.getBoundingClientRect();
    const pct = clientXToPct(e.clientX, rect);
    onSeek?.(pctToTime(pct));

    const onMove = (me) => {
      const r = waveContainerRef.current?.getBoundingClientRect();
      if (!r) return;
      onSeek?.(pctToTime(clientXToPct(me.clientX, r)));
    };
    const onUp = () => {
      isDraggingPlayhead.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isReady, duration, onSeek, pctToTime, clientXToPct]);

  // ─── Loop handle drag ─────────────────────────────────────────────────────
  const handleLoopHandleDrag = useCallback((which, e) => {
    e.stopPropagation();
    if (!duration || !waveContainerRef.current) return;

    const onMove = (me) => {
      const r = waveContainerRef.current?.getBoundingClientRect();
      if (!r) return;
      const t = pctToTime(clientXToPct(me.clientX, r));
      if (which === 'A') {
        onLoopChange?.(Math.min(t, loopB - 0.1), loopB);
      } else {
        onLoopChange?.(loopA, Math.max(t, loopA + 0.1));
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [duration, loopA, loopB, onLoopChange, pctToTime, clientXToPct]);

  // ─── Sync wavesurfer with audio element ──────────────────────────────────
  useEffect(() => {
    if (!wavesurferRef.current || !audioRef.current || !isReady) return;
    const ws = wavesurferRef.current;
    const audio = audioRef.current;
    const handleTimeUpdate = () => {
      if (Math.abs(ws.getCurrentTime() - audio.currentTime) > 0.1) {
        ws.setTime(audio.currentTime);
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isReady, audioRef]);

  // ─── Initialise WaveSurfer ────────────────────────────────────────────────
  useEffect(() => {
    if (!showWaveform || !localUrl) return;
    if (wavesurferRef.current) wavesurferRef.current.destroy();
    if (!waveContainerRef.current) return;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1DB954';

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: primaryColor + '55',
      progressColor: primaryColor,
      cursorColor: 'transparent', // we draw our own cursor
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      normalize: true,
      interact: false,
      hideScrollbar: true,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;
    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      if (audioRef.current) ws.setTime(audioRef.current.currentTime);
    });

    ws.load(localUrl);

    return () => {
      ws.destroy();
      setIsReady(false);
    };
  }, [showWaveform, localUrl, audioRef]);

  // ─── Draw line markers on the waveform ───────────────────────────────────
  useEffect(() => {
    if (!wavesurferRef.current || !isReady || !lines?.length || !duration) return;
    const regions = regionsRef.current;
    regions.clearRegions();

    lines.forEach((line, idx) => {
      if (line.timestamp != null) {
        const nextTs = lines[idx + 1]?.timestamp || duration;
        regions.addRegion({
          start: line.timestamp,
          end: line.timestamp + 0.06,
          color: 'rgba(255,255,255,0.2)',
          drag: false, resize: false,
        });
        if (playbackPosition >= line.timestamp && playbackPosition < nextTs) {
          regions.addRegion({
            start: line.timestamp,
            end: nextTs,
            color: 'rgba(29,185,84,0.10)',
            drag: false, resize: false,
            id: 'active-line-span',
          });
        }
      }
    });
  }, [isReady, lines, duration, playbackPosition]);

  // ─── Ruler tick logic ─────────────────────────────────────────────────────
  const rulerTicks = useMemo(() => {
    if (!duration || duration <= 0) return [];
    // Pick interval so we have ~8 labels max
    const intervals = [5, 10, 15, 30, 60, 120, 300];
    const interval = intervals.find(iv => duration / iv <= 12) ?? 300;
    const ticks = [];
    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ t, pct: (t / duration) * 100 });
    }
    return ticks;
  }, [duration]);

  const playbackPct = duration > 0 ? Math.min(100, (playbackPosition / duration) * 100) : 0;
  const loopAPct = loopA != null && duration > 0 ? (loopA / duration) * 100 : null;
  const loopBPct = loopB != null && duration > 0 ? (loopB / duration) * 100 : null;

  if (!showWaveform) return null;

  return (
    <div className="w-full flex flex-col gap-0 mt-2">
      {/* Main waveform + overlays */}
      <div
        ref={waveContainerRef}
        className="w-full h-10 relative rounded-lg overflow-hidden bg-zinc-900/40 border border-zinc-800/50 cursor-crosshair select-none"
        onMouseDown={handleWaveMouseDown}
      >
        {/* WaveSurfer renders inside here */}

        {/* Loading skeleton */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 backdrop-blur-[2px]">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1 h-3 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Loop region overlay */}
        {isReady && loopAPct != null && loopBPct != null && (
          <div
            className="absolute top-0 bottom-0 bg-violet-500/20 border-x border-violet-400/60 pointer-events-none z-10"
            style={{ left: `${loopAPct}%`, width: `${loopBPct - loopAPct}%` }}
          />
        )}

        {/* Loop handle A */}
        {isReady && loopAPct != null && (
          <div
            className="absolute top-0 bottom-0 w-2 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group"
            style={{ left: `${loopAPct}%` }}
            onMouseDown={(e) => handleLoopHandleDrag('A', e)}
          >
            <div className="w-1 h-6 bg-violet-400 rounded-full group-hover:bg-violet-300 transition-colors shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
          </div>
        )}

        {/* Loop handle B */}
        {isReady && loopBPct != null && (
          <div
            className="absolute top-0 bottom-0 w-2 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group"
            style={{ left: `${loopBPct}%` }}
            onMouseDown={(e) => handleLoopHandleDrag('B', e)}
          >
            <div className="w-1 h-6 bg-violet-400 rounded-full group-hover:bg-violet-300 transition-colors shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
          </div>
        )}

        {/* Playback line */}
        {isReady && (
          <div
            className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 pointer-events-none z-30 transition-[left] duration-75 ease-linear"
            style={{ left: `${playbackPct}%`, background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }}
          />
        )}
      </div>

      {/* Ruler with labelled ticks */}
      {isReady && duration > 0 && (
        <div className="w-full h-5 relative select-none">
          {rulerTicks.map(({ t, pct }) => (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-1.5 bg-zinc-700" />
              <span className="text-[9px] text-zinc-500 font-mono tabular-nums mt-0.5 leading-none whitespace-nowrap">
                {formatTime(t)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WaveformDisplay;
