import { cn } from '@/shared/utils/utils';
// eslint-disable-next-line no-unused-vars
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollProgress({ className, springOptions }) {
  const motionValue = useMotionValue(0);
  const scaleX = useSpring(motionValue, {
    stiffness: 200,
    damping: 50,
    restDelta: 0.001,
    ...springOptions,
  });
  const location = useLocation();

  // Reset bar on route change
  useEffect(() => {
    motionValue.set(0);
  }, [location.pathname, motionValue]);

  useEffect(() => {
    const handleScroll = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const scrollMax = el.scrollHeight - el.clientHeight;
      if (scrollMax <= 0) return;
      // Don't let modal content drive the header bar
      if (el.closest('.z-modal')) return;
      motionValue.set(el.scrollTop / scrollMax);
    };

    // capture: true — scroll doesn't bubble, but fires on capture phase for any element
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true, passive: true });
  }, [motionValue]);

  return (
    <motion.div
      className={cn(
        'fixed inset-x-0 top-0 z-nav h-1 origin-left bg-gradient-to-r from-primary to-accent-blue',
        className,
      )}
      style={{ scaleX }}
    />
  );
}
