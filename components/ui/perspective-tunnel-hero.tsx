"use client";

import {
  motion,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  animate,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const IMAGES = [
  { src: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80", title: "Study Sync" },
  { src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80", title: "AI Timetable" },
  { src: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80", title: "PDF Parser" },
  { src: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80", title: "Smart Breaks" },
  { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80", title: "Focus Mode" },
  { src: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80", title: "Health-First" },
  { src: "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=600&q=80", title: "Analytics" },
  { src: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80", title: "Syllabus Sync" },
  { src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80", title: "Overview" },
];

interface TunnelCardData {
  item: { src: string; title: string };
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

const TUNNEL_CARDS: TunnelCardData[] = IMAGES.map((item, i) => {
  const goldenAngle = i * 137.5 * (Math.PI / 180);
  const radiusFactorX = 0.28 + (i % 3) * 0.08;
  const radiusFactorY = 0.26 + (i % 2) * 0.09;

  return {
    item,
    angleCos: Math.cos(goldenAngle),
    angleSin: Math.sin(goldenAngle),
    radiusFactorX,
    radiusFactorY,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
    index: i,
  };
});

const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG);
  const y = useSpring(rawY, SPRING_CONFIG);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, rawX, rawY]);

  return { x, y };
}

interface TunnelCardProps {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
}

function TunnelCard({ card, progress, pointer, total, stage }: TunnelCardProps) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;

  const localProgress = useTransform(progress, [start, end], [0, 1], { clamp: true });

  const farZ = stage.isMobile ? -1200 : -1700;
  const nearZ = stage.isMobile ? 350 : 500;
  const z = useTransform(localProgress, [0, 1], [farZ, nearZ]);

  const opacity = useTransform(localProgress, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(130, Math.min(180, stage.width * 0.38))
    : Math.max(180, Math.min(270, stage.width * 0.18));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 45;

  const transform = useTransform(
    [z, pointer.x, pointer.y],
    ([currZ, px, py]: number[]) => {
      const offsetX = baseX - px * panStrength;
      const offsetY = baseY - py * panStrength;
      return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
    }
  );

  const pointerEvents = useTransform(opacity, (o: number) => (o > 0.1 ? "auto" : "none"));

  return (
    <motion.div
      style={{
        width: cardWidth,
        transform,
        opacity,
        zIndex: card.index + 1,
        pointerEvents,
      }}
      className="pointer-events-auto absolute left-1/2 top-1/2 aspect-[4/5] will-change-transform select-none cursor-pointer"
    >
      <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl shadow-black/90 ring-1 ring-white/15 transition-all duration-500 hover:ring-[#A3E635]/70 hover:shadow-[#A3E635]/20">
        <img
          src={card.item.src}
          alt={card.item.title}
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-4 sm:p-5">
          <span className="text-xs sm:text-sm font-mono tracking-widest uppercase text-white/95 drop-shadow-md">
            {card.item.title}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export interface PerspectiveTunnelHeroProps {
  initialReverse?: boolean;
  onReverseComplete?: () => void;
}

export default function PerspectiveTunnelHero({
  initialReverse = false,
  onReverseComplete,
}: PerspectiveTunnelHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);

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
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 85,
    damping: 32,
    restDelta: 0.0001,
  });

  // Handle Reverse Scroll Motion: smoothly rewind from 1 back down to 0
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shouldReverse = initialReverse || params.get("reverse") === "1";

    if (shouldReverse) {
      setIsRewinding(true);
      // Immediately place at tunnel end (near camera)
      rawProgress.set(1.0);

      // Smoothly animate the reverse flight back to start over 1.4 seconds
      const controls = animate(rawProgress, 0, {
        duration: 1.4,
        ease: [0.16, 1, 0.3, 1], // Cubic ease-out
        onComplete: () => {
          setIsRewinding(false);
          window.history.replaceState({}, "", "/hero");
          onReverseComplete?.();
        },
      });

      return () => controls.stop();
    }
  }, [rawProgress, initialReverse, onReverseComplete]);

  // Listen to wheel scrolling (bidirectional: down advances, up rewinds)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const current = rawProgress.get();
      const delta = e.deltaY * 0.0008;
      const next = Math.min(1, Math.max(0, current + delta));
      rawProgress.set(next);

      // Trigger forward transition to overview dashboard
      if (next >= 0.98 && !isNavigating) {
        setIsNavigating(true);
        setTimeout(() => {
          router.push("/");
        }, 320);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [rawProgress, isNavigating, router]);

  const pointer = useCameraParallax(!reduce);

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.7, 1, 1.35]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.12, 0.85, 1], [0.25, 1, 1, 0]);
  const promptOpacity = useTransform(smoothProgress, [0, 0.12], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="relative h-[100svh] w-screen overflow-hidden bg-[#0B0F17] text-white select-none flex items-center justify-center"
      style={{
        perspective: stage.isMobile ? "900px" : "1200px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Immersive Dark Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] opacity-65" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.12)_0%,transparent_75%)]" />

      {/* Depth Ring Guides */}
      <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-lime-500/20" />
      <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-white/10" />

      {/* Central Headline */}
      <motion.div
        style={{ scale: titleScale, opacity: titleOpacity }}
        className="pointer-events-none z-0 flex flex-col items-center text-center px-6 max-w-xl"
      >
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#A3E635] mb-4">
          StudySync AI • Health-First
        </p>
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter leading-[0.9] bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
          STUDYSYNC
          <br />
          WORKFLOW
        </h1>
        <p className="mt-4 max-w-[36ch] text-sm sm:text-base font-light text-slate-400">
          Scroll down to warp forward into your dashboard, or scroll up to return to the intro.
        </p>
      </motion.div>

      {/* Scroll Hint */}
      <motion.div
        style={{ opacity: promptOpacity }}
        className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-slate-400"
      >
        <span>{isRewinding ? "Rewinding Tunnel..." : "Scroll down to Warp"}</span>
        <div className="h-6 w-px bg-gradient-to-b from-[#A3E635] to-transparent animate-pulse" />
      </motion.div>

      {/* 3D Z-Space Plane */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ transformStyle: "preserve-3d" }}
      >
        {TUNNEL_CARDS.map((card, i) => (
          <TunnelCard
            key={i}
            card={card}
            pointer={pointer}
            progress={smoothProgress}
            stage={stage}
            total={TUNNEL_CARDS.length}
          />
        ))}
      </div>

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
              Warping to Dashboard...
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export { PerspectiveTunnelHero, TUNNEL_CARDS, TunnelCard, useCameraParallax };
