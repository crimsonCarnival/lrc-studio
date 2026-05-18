import { useState, useEffect, useRef } from 'react';
import Aurora from './Aurora';
import Antigravity from './Antigravity';

function readThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    primary:      get('--color-primary')       || '#c4a7e7',
    accentPurple: get('--color-accent-purple') || '#c4a7e7',
    accentBlue:   get('--color-accent-blue')   || '#9ccfd8',
  };
}

export default function LandingBackground() {
  const [colors, setColors] = useState(readThemeColors);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const onMove = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove, { passive: true });

    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('mousemove', onMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0">
        <Aurora
          colorStops={[colors.primary, colors.accentBlue, colors.accentPurple]}
          amplitude={1.2}
          blend={0.6}
        />
      </div>
      <div className="absolute inset-0 blur-[3px]">
        <Antigravity
          mouseRef={mouseRef}
          count={200}
          color={colors.primary}
          magnetRadius={8}
          ringRadius={8}
          waveSpeed={0.4}
          waveAmplitude={1}
          particleSize={1.5}
          lerpSpeed={0.06}
          autoAnimate
          particleVariance={1}
          pulseSpeed={3}
          particleShape="capsule"
          fieldStrength={10}
        />
      </div>
    </div>
  );
}
