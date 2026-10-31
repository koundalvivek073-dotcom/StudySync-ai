'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  motion,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  animate,
} from 'framer-motion';
import { DotField } from '@/components/ui/dot-field';
import {
  TUNNEL_CARDS,
  TunnelCard,
  useCameraParallax,
} from '@/components/ui/perspective-tunnel-hero';
import { Sparkles } from 'lucide-react';

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

export default function HeroPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const [isReverse, setIsReverse] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const [stage, setStage] = useState<StageDimensions>({
    width: 1440,
    height: 900,
    isMobile: false,
  });

  useEffect(() => {
    const updateDimensions = () => {
      setStage({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Unified scroll progress: 0.0 (DotField Hero) to 1.0 (End of 3D Perspective Tunnel)
  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 80,
    damping: 28,
    restDelta: 0.0001,
  });

  // Dot headline scatter progress: scatters dots into grid between progress 0.0 and 0.32
  const scatterProgress = useTransform(smoothProgress, [0, 0.32], [0, 1], { clamp: true });

  // 3D Perspective Tunnel progress: cards fly through perspective between progress 0.12 and 0.98
  const tunnelProgress = useTransform(smoothProgress, [0.12, 0.98], [0, 1], { clamp: true });

  // Parallax camera for 3D tunnel
  const pointer = useCameraParallax(!reduce);

  // Check for reverse query param: ?reverse=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reverse') === '1') {
      setIsReverse(true);
      setIsRewinding(true);
      // Place immediately at tunnel exit (near camera)
      rawProgress.set(1.0);

      // Smoothly animate the reverse flight from 1.0 back down to 0.0
      const controls = animate(rawProgress, 0, {
        duration: 1.45,
        ease: [0.16, 1, 0.3, 1], // Cubic ease-out
        onComplete: () => {
          setIsRewinding(false);
          setIsReverse(false);
          window.history.replaceState({}, '', '/hero');
        },
      });

      return () => controls.stop();
    }
  }, [rawProgress]);

  // Unified wheel scroll listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isNavigating) return;

      const current = rawProgress.get();
      const delta = e.deltaY * 0.0009;
      const next = Math.min(1, Math.max(0, current + delta));
      rawProgress.set(next);

      // Trigger forward transition to overview dashboard at tunnel exit
      if (next >= 0.97 && !isNavigating) {
        setIsNavigating(true);
        setTimeout(() => {
          router.push('/');
        }, 320);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [rawProgress, isNavigating, router]);

  // Touch swipe support for mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0 || isNavigating) return;
      const currentY = e.touches[0].clientY;
      const deltaY = (touchStartY - currentY) * 0.003;
      touchStartY = currentY;

      const current = rawProgress.get();
      const next = Math.min(1, Math.max(0, current + deltaY));
      rawProgress.set(next);

      if (next >= 0.97 && !isNavigating) {
        setIsNavigating(true);
        setTimeout(() => {
          router.push('/');
        }, 320);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [rawProgress, isNavigating, router]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        const current = rawProgress.get();
        const next = Math.min(1, current + 0.18);
        rawProgress.set(next);
        if (next >= 0.97 && !isNavigating) {
          setIsNavigating(true);
          setTimeout(() => router.push('/'), 320);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        const current = rawProgress.get();
        rawProgress.set(Math.max(0, current - 0.18));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawProgress, isNavigating, router]);

  // Subtle bottom hint opacity (fades out as tunnel begins)
  const hintOpacity = useTransform(smoothProgress, [0, 0.1], [1, 0]);

  return (
    <main
      ref={containerRef}
      className="relative h-[100svh] w-screen overflow-hidden bg-[#0B0F17] text-white select-none"
      style={{
        perspective: stage.isMobile ? '900px' : '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Layer 1: DotField Canvas & Headline Hero */}
      <div className="absolute inset-0 z-0">
        <DotField
          headline="StudySync AI"
          accent="#A3E635"
          scrollScatter={false}
          scatterProgress={scatterProgress}
          immediateReady={isReverse}
          eyebrow={
            <span className="flex items-center gap-1.5 text-white/90">
              <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" /> Health-First Timetable Maker
            </span>
          }
          description="Transform your syllabus PDFs and screenshots into personalized, intelligent study schedules automatically."
          actions={undefined}
          scrollHint={false}
        />
      </div>

      {/* Layer 2: 3D Perspective Tunnel Cards */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {TUNNEL_CARDS.map((card, i) => (
          <TunnelCard
            key={i}
            card={card}
            pointer={pointer}
            progress={tunnelProgress}
            stage={stage}
            total={TUNNEL_CARDS.length}
          />
        ))}
      </div>

      {/* Subtle Scroll Hint Indicator (No Buttons) */}
      <motion.div
        style={{ opacity: hintOpacity }}
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-slate-400"
      >
        <span>{isRewinding ? 'Rewinding Tunnel...' : 'Scroll down to explore'}</span>
        <div className="h-6 w-px bg-gradient-to-b from-[#A3E635] to-transparent animate-pulse" />
      </motion.div>

      {/* Forward Warp Exit Flash */}
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-50 bg-[#0B0F17] flex items-center justify-center pointer-events-none"
        >
          <div className="text-center animate-pulse">
            <span className="text-xs font-mono tracking-widest uppercase text-[#A3E635]">
              Entering Dashboard...
            </span>
          </div>
        </motion.div>
      )}
    </main>
  );
}
