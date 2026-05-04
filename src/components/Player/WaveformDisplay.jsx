import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { formatTime } from '../../utils/formatTime';
import { Tip } from '@/components/ui/tip';
const MARKER_CLICK_THRESHOLD = 8; // px — how close a click must be to snap to a marker

const WaveformDisplay = React.memo(function WaveformDisplay({ 
  audioRef, 
  localUrl, 
  showWaveform, 
  waveformSnap,
  onTimeUpdate,
  lines,
  playbackPosition,
  duration,
}) {
  const wavesurferRef = useRef(null);
  const waveContainerRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const wrapperRef = useRef(null); // outer wrapper for positioning the canvas overlay
  const cleanupListenersRef = useRef(null);
  const waveformSnapRef = useRef(waveformSnap);
  waveformSnapRef.current = waveformSnap;
  const [isLoading, setIsLoading] = useState(false);
  const timestampsRef = useRef([]);

  // Extract sorted timestamps from lines
  const timestamps = useMemo(() => {
    if (!lines) return [];
    return lines
      .filter((l) => l.timestamp != null)
      .map((l) => l.timestamp)
      .sort((a, b) => a - b);
  }, [lines]);
  timestampsRef.current = timestamps;

  // Get the WaveSurfer internal scrollable wrapper for accurate dimensions
  const getWsWrapper = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return null;
    // WaveSurfer 7.x: getWrapper() returns the inner wrapper element
    if (typeof ws.getWrapper === 'function') return ws.getWrapper();
    // Fallback: find the first scrollable child of the container (skip our canvas)
    const container = waveContainerRef.current;
    if (!container) return null;
    for (const child of container.children) {
      if (child.tagName !== 'CANVAS') return child;
    }
    return null;
  }, []);

  // Draw overlay: timestamp markers + active region shading
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !duration) return;

    const wsWrapper = getWsWrapper();
    const scrollLeft = wsWrapper?.scrollLeft || 0;
    const totalWidth = wsWrapper?.scrollWidth || wrapper.clientWidth;
    const visibleWidth = wrapper.clientWidth;
    const visibleHeight = wrapper.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = visibleWidth * dpr;
    canvas.height = visibleHeight * dpr;
    canvas.style.width = visibleWidth + 'px';
    canvas.style.height = visibleHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, visibleWidth, visibleHeight);

    // Find active region (current timestamp → next timestamp)
    let activeStart = null;
    let activeEnd = null;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] <= playbackPosition) {
        activeStart = timestamps[i];
        activeEnd = timestamps[i + 1] ?? null;
      }
    }

    // Helper: convert time to x pixel position (accounting for scroll)
    const timeToX = (t) => (t / duration) * totalWidth - scrollLeft;

    // Draw active region shading
    if (activeStart != null) {
      const x1 = timeToX(activeStart);
      const x2 = activeEnd != null ? timeToX(activeEnd) : timeToX(playbackPosition);
      const clampedX1 = Math.max(0, x1);
      const clampedX2 = Math.min(visibleWidth, x2);
      if (clampedX2 > clampedX1) {
        ctx.fillStyle = 'rgba(29, 185, 84, 0.08)';
        ctx.fillRect(clampedX1, 0, clampedX2 - clampedX1, visibleHeight);
      }
    }

    // Draw timestamp markers
    ctx.strokeStyle = 'rgba(29, 185, 84, 0.35)';
    ctx.lineWidth = 1;
    for (const ts of timestamps) {
      const x = timeToX(ts);
      if (x < -1 || x > visibleWidth + 1) continue; // off-screen
      const px = Math.round(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, visibleHeight);
      ctx.stroke();

      // Small tick at top
      ctx.fillStyle = 'rgba(29, 185, 84, 0.6)';
      ctx.fillRect(px - 1.5, 0, 3, 3);
    }
  }, [timestamps, playbackPosition, duration, getWsWrapper]);

  // Redraw overlay on each render
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Also redraw on resize and scroll
  useEffect(() => {
    if (!showWaveform) return;
    const handleResize = () => drawOverlay();
    window.addEventListener('resize', handleResize);

    // Listen for scroll on WaveSurfer's internal wrapper
    const wsWrapper = getWsWrapper();
    const handleScroll = () => drawOverlay();
    wsWrapper?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      wsWrapper?.removeEventListener('scroll', handleScroll);
    };
  }, [showWaveform, drawOverlay, getWsWrapper]);

  // Handle clicks on the overlay — snap to nearest marker if close enough
  const handleOverlayClick = useCallback((e) => {
    const wrapper = wrapperRef.current;
    const audioEl = audioRef.current;
    if (!wrapper || !audioEl || !duration) return;

    const wsWrapper = getWsWrapper();
    const scrollLeft = wsWrapper?.scrollLeft || 0;
    const totalWidth = wsWrapper?.scrollWidth || wrapper.clientWidth;
    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Find closest marker
    let closestTs = null;
    let closestDist = Infinity;
    for (const ts of timestampsRef.current) {
      const markerX = (ts / duration) * totalWidth - scrollLeft;
      const dist = Math.abs(markerX - clickX);
      if (dist < closestDist) {
        closestDist = dist;
        closestTs = ts;
      }
    }

    if (closestTs != null && closestDist <= MARKER_CLICK_THRESHOLD) {
      // Snap to the marker timestamp
      audioEl.currentTime = closestTs;
      onTimeUpdate?.(closestTs);
    } else {
      // Normal seek — compute absolute time accounting for scroll
      const absoluteX = scrollLeft + clickX;
      const percentage = Math.max(0, Math.min(absoluteX / totalWidth, 1));
      const rawTime = percentage * (audioEl.duration || 0);
      const time = waveformSnapRef.current ? Math.round(rawTime) : rawTime;
      audioEl.currentTime = time;
      onTimeUpdate?.(time);
    }
  }, [duration, getWsWrapper, onTimeUpdate, audioRef]);

  const initWaveform = useCallback(async (url, audioEl) => {
    setIsLoading(true);
    // Dynamically import wavesurfer.js
    const WaveSurfer = (await import('wavesurfer.js')).default;

    // Destroy previous instance + remove old listeners
    if (cleanupListenersRef.current) cleanupListenersRef.current();
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    if (!waveContainerRef.current) return;

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: 'rgba(29, 185, 84, 0.4)',
      progressColor: '#1DB954',
      cursorColor: '#1DB954',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 48,
      normalize: true,
      interact: false,
      media: audioEl,
      backend: 'MediaElement',
      autoScroll: true,
      autoCenter: false,
    });

    ws.on('seeking', (time) => {
      onTimeUpdate?.(time);
    });

    ws.on('ready', () => {
      setIsLoading(false);
      
      // Inject custom scrollbar CSS into the Shadow DOM
      const wrapper = ws.getWrapper?.();
      const shadowRoot = wrapper?.getRootNode();
      if (shadowRoot && shadowRoot instanceof ShadowRoot) {
        const style = document.createElement('style');
        style.textContent = `
          ::-webkit-scrollbar {
            height: 4px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 9999px;
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
          }
        `;
        shadowRoot.appendChild(style);
      }
    });

    // Cursor following state
    let isFollowingCursor = false;
    let tooltipElement = null;

    const formatWaveTime = formatTime;

    // Use the outer wrapper (wrapperRef) for mouse events since the overlay canvas sits on top
    const eventTarget = wrapperRef.current;

    const createTooltip = () => {
      if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.85);
          color: #1DB954;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
          pointer-events: none;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.15s ease-in-out;
          white-space: nowrap;
          border: 1px solid rgba(29, 185, 84, 0.3);
        `;
        eventTarget?.appendChild(tooltipElement);
      }
      return tooltipElement;
    };

    const updateTooltip = (e) => {
      const tooltip = createTooltip();
      const rect = eventTarget?.getBoundingClientRect();
      if (!rect) return;

      const wsWrapper = ws.getWrapper?.();
      const scrollLeft = wsWrapper?.scrollLeft || 0;
      const totalWidth = wsWrapper?.scrollWidth || rect.width;

      const x = e.clientX - rect.left;
      const absoluteX = scrollLeft + x;
      const percentage = Math.max(0, Math.min(absoluteX / totalWidth, 1));
      const time = percentage * (audioEl.duration || 0);

      tooltip.textContent = formatWaveTime(time);
      tooltip.style.left = (x - tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = '-28px';
      
      // Delay opacity to allow positioning to happen first without jump
      requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
      });
    };

    const handleMouseMove = (e) => {
      if (isFollowingCursor) {
        const rect = eventTarget?.getBoundingClientRect();
        if (!rect) return;

        const wsWrapper = ws.getWrapper?.();
        const scrollLeft = wsWrapper?.scrollLeft || 0;
        const totalWidth = wsWrapper?.scrollWidth || rect.width;

        const x = e.clientX - rect.left;
        const absoluteX = scrollLeft + x;
        const percentage = Math.max(0, Math.min(absoluteX / totalWidth, 1));
        const rawTime = percentage * (audioEl.duration || 0);
        const time = waveformSnapRef.current ? Math.round(rawTime) : rawTime;

        audioEl.currentTime = time;
        onTimeUpdate?.(time);
      }
      updateTooltip(e);
    };

    const handleMouseDown = (e) => {
      // Don't start drag on single clicks — let the overlay onClick handle marker snapping
      // Only start drag-seek mode (isFollowingCursor) for continued mouse moves
      isFollowingCursor = true;
    };

    const handleMouseUp = () => {
      isFollowingCursor = false;
    };

    const handleMouseLeave = () => {
      if (tooltipElement) {
        tooltipElement.style.opacity = '0';
      }
      isFollowingCursor = false;
    };

    eventTarget?.addEventListener('mouseenter', createTooltip);
    eventTarget?.addEventListener('mousemove', handleMouseMove, { passive: true });
    eventTarget?.addEventListener('mouseleave', handleMouseLeave);
    eventTarget?.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    cleanupListenersRef.current = () => {
      eventTarget?.removeEventListener('mouseenter', createTooltip);
      eventTarget?.removeEventListener('mousemove', handleMouseMove);
      eventTarget?.removeEventListener('mouseleave', handleMouseLeave);
      eventTarget?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
      }
      cleanupListenersRef.current = null;
    };

    wavesurferRef.current = ws;
  }, [onTimeUpdate]);

  useEffect(() => {
    if (!showWaveform) {
      if (cleanupListenersRef.current) cleanupListenersRef.current();
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      return;
    }
    
    if (localUrl && audioRef.current && waveContainerRef.current) {
      // Small delay to ensure audio element has loaded before binding WaveSurfer
      const timer = setTimeout(() => {
        initWaveform(localUrl, audioRef.current);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [localUrl, initWaveform, showWaveform, audioRef]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (cleanupListenersRef.current) cleanupListenersRef.current();
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, []);

  if (!showWaveform) return null;

  return (
    <div className="space-y-1">
      <div ref={wrapperRef} className="relative w-full rounded-lg overflow-hidden bg-zinc-900/40 border border-zinc-800/50 cursor-pointer">
        {/* Skeleton shimmer while WaveSurfer initializes */}
        {isLoading && (
          <div className="skeleton-wave absolute inset-0 z-raised rounded-lg" style={{ height: 48 }} />
        )}
        {/* WaveSurfer renders into this div */}
        <div ref={waveContainerRef} className="w-full" />
        {/* Overlay canvas — sibling to WaveSurfer container, not a child */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 z-base"
          style={{ cursor: 'pointer' }}
          onClick={handleOverlayClick}
        />
      </div>
    </div>
  );
});

export default WaveformDisplay;
