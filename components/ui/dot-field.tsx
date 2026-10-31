"use client";

import * as React from "react";

/* ------------------------------------------------------------------ */
/*  Dot Field: a hero whose headline is assembled from the dot grid.   */
/*  Dots fly in like a flock, the cursor pushes them away, a glow      */
/*  runs through the letters and scrolling scatters them back.         */
/*  Canvas only, no dependencies. Colors follow the theme              */
/*  (text-foreground / bg-background), so light and dark both work.    */
/* ------------------------------------------------------------------ */

export interface DotFieldProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Headline drawn with dots. Also rendered as a real <h1> for screen readers. */
  headline: string;
  /** Small pill above the headline. */
  eyebrow?: React.ReactNode;
  /** Supporting line under the headline. */
  description?: React.ReactNode;
  /** Buttons or links under the description. */
  actions?: React.ReactNode;
  /** Glow color that runs through the letters. */
  accent?: string;
  /** Grid spacing in px: [x, y]. */
  grid?: [number, number];
  /** Font used to draw the headline. Make sure it is loaded on the page. */
  fontFamily?: string;
  fontWeight?: number;
  /** Radius of the cursor push, in px. 0 turns it off. */
  repelRadius?: number;
  /** Scatter the headline back into the grid while the page scrolls. */
  scrollScatter?: boolean;
  /** Explicit scatter progress from 0 (gathered text) to 1 (scattered grid). Accepts number or MotionValue. */
  scatterProgress?: number | { get: () => number };
  /** Skip initial intro delay (useful for reverse transitions). */
  immediateReady?: boolean;
  /** Labels for the scroll hint at the bottom, or false to hide it. */
  scrollHint?: { scatter: string; gather: string } | false;
  /** Called when the intro has finished. */
  onReady?: () => void;
}

export interface DotFieldHandle {
  /** Play the intro again. */
  replay: () => void;
  /** Scatter (true) or gather (false) without scrolling. */
  setScattered: (scattered: boolean) => void;
}

const FLOW = (x: number, y: number, t: number) =>
  (Math.sin(x * 0.004 + t * 0.7) + Math.cos(y * 0.005 - t * 0.5) + Math.sin((x + y) * 0.002 + t * 0.3)) * Math.PI;

export const DotField = React.forwardRef<DotFieldHandle, DotFieldProps>(function DotField(
  {
    headline,
    eyebrow,
    description,
    actions,
    accent = "#A3E635",
    grid = [20, 13],
    fontFamily = "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif",
    fontWeight = 600,
    repelRadius = 120,
    scrollScatter = true,
    scatterProgress,
    immediateReady = false,
    scrollHint = { scatter: "Scroll to scatter", gather: "Scroll up to gather" },
    onReady,
    className = "",
    style,
    ...rest
  },
  ref,
) {
  const outerRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const dotsRef = React.useRef<HTMLCanvasElement>(null);
  const glowRef = React.useRef<HTMLCanvasElement>(null);
  const spotRef = React.useRef<HTMLDivElement>(null);
  const copyRef = React.useRef<HTMLDivElement>(null);
  const hintRef = React.useRef<HTMLDivElement>(null);
  const hintLabelRef = React.useRef<HTMLSpanElement>(null);
  const [ready, setReady] = React.useState(immediateReady);
  const readyRef = React.useRef(immediateReady);

  // everything the render loop needs lives in one mutable object
  const S = React.useRef({
    W: 0, H: 0, N: 0, P: new Float32Array(0), t0: 0,
    scrollP: 0, btnP: 0, btnT: 0, scatter: 0, last: 0, kick: 0,
    mouse: { x: -9999, y: -9999, on: false },
    restart: () => {},
  });

  const opts = React.useRef({ headline, fontFamily, fontWeight, grid, repelRadius, accent, onReady, scatterProgress, immediateReady });
  opts.current = { headline, fontFamily, fontWeight, grid, repelRadius, accent, onReady, scatterProgress, immediateReady };

  React.useImperativeHandle(ref, () => ({
    replay: () => S.current.restart(),
    setScattered: (v) => { S.current.btnT = v ? 1 : 0; },
  }), []);

  React.useEffect(() => {
    const stage = stageRef.current;
    const cv = dotsRef.current;
    const gl = glowRef.current;
    if (!stage || !cv || !gl) return;

    const ctx = cv.getContext("2d");
    const gtx = gl.getContext("2d");
    if (!ctx || !gtx) return;

    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = S.current;
    let raf = 0, visible = true, alive = true, readyTimer = 0;
    let fg = "#fff", frameNo = 0;

    const readFg = () => { fg = getComputedStyle(stage).color || fg; };

    /* lay the headline out on an offscreen canvas and sample its pixels */
    const sample = () => {
      const { W, H } = s, o = opts.current;
      const c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return [];
      c.width = W; c.height = H;
      const font = (px: number) => `${o.fontWeight} ${px}px ${o.fontFamily}`;
      const words = o.headline.split(/\s+/);
      let size = Math.min(W * 0.115, H * 0.2, 168), lines: string[] = [];
      for (;;) {
        g.font = font(size); lines = []; let cur = "";
        for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > W * 0.88 && cur) { lines.push(cur); cur = w; } else cur = t; }
        lines.push(cur);
        if ((lines.length <= 3 && lines.every((l) => g.measureText(l).width <= W * 0.92)) || size < 28) break;
        size *= 0.9;
      }
      g.font = font(size); g.textAlign = "center"; g.textBaseline = "middle";
      try { (g as any).letterSpacing = `${-size * 0.05}px`; } catch {}
      const lh = size * 0.98, top = H * 0.46 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => g.fillText(l, W / 2, top + i * lh));
      const d = g.getImageData(0, 0, W, H).data, pts: number[] = [], step = Math.max(3, Math.round(size / 30));
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
      return pts;
    };

    /* one Float32Array, 10 slots per dot: x y vx vy homeX homeY textX textY delay isText */
    const build = () => {
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      s.W = Math.max(1, Math.round(r.width)); s.H = Math.max(1, Math.round(r.height));
      for (const c of [cv, gl]) { c.width = s.W * dpr; c.height = s.H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); gtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [GX, GY] = opts.current.grid, tgt = sample();
      const cols = Math.ceil(s.W / GX) + 1, rows = Math.ceil(s.H / GY) + 1, cells = cols * rows, nText = tgt.length / 2;
      s.N = Math.max(cells, nText);
      const P = new Float32Array(s.N * 10);
      for (let i = 0; i < s.N; i++) {
        const cell = i < cells ? i : (Math.random() * cells) | 0;
        const hx = (cell % cols) * GX - 6, hy = Math.floor(cell / cols) * GY - 1, o = i * 10;
        P[o] = hx; P[o + 1] = hy; P[o + 4] = hx; P[o + 5] = hy;
      }
      const ids = Array.from({ length: s.N }, (_, i) => i);
      for (let i = ids.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
      const diag = Math.hypot(s.W, s.H);
      for (let k = 0; k < nText; k++) {
        const o = ids[k] * 10, tx = tgt[k * 2], ty = tgt[k * 2 + 1];
        P[o + 6] = tx; P[o + 7] = ty; P[o + 9] = 1;
        P[o + 8] = 0.15 + Math.min(0.9, Math.hypot(tx - s.W / 2, ty - s.H * 0.46) / diag) * 1.1 + Math.random() * 0.25;
      }
      s.P = P;
    };

    const getScatterProgress = () => {
      const sp = opts.current.scatterProgress;
      if (typeof sp === "number") return sp;
      if (sp && typeof sp.get === "function") return sp.get();
      return Math.max(s.scrollP, s.btnP);
    };

    const setCopy = () => {
      const p = getScatterProgress(), show = readyRef.current;
      if (copyRef.current) copyRef.current.style.opacity = show ? String(Math.max(0, 1 - p * 2.5)) : "";
      if (hintRef.current && hintLabelRef.current && scrollHint) {
        const up = p > 0.85;
        hintRef.current.dataset.up = up ? "true" : "false";
        hintLabelRef.current.textContent = up ? scrollHint.gather : scrollHint.scatter;
        hintRef.current.style.opacity = show ? String(up ? 1 : Math.max(0, 1 - p * 5)) : "0";
      }
    };

    const restart = () => {
      if (scrollScatter && s.scrollP > 0) outerRef.current?.scrollIntoView({ block: "start" });
      s.btnP = s.btnT = 0; s.kick = 0;
      readFg(); build();
      if (opts.current.immediateReady) {
        s.t0 = performance.now() - 3000;
        readyRef.current = true;
        setReady(true);
        setCopy();
        opts.current.onReady?.();
      } else {
        s.t0 = performance.now();
        readyRef.current = false;
        setReady(false);
        window.clearTimeout(readyTimer);
        readyTimer = window.setTimeout(() => {
          readyRef.current = true;
          setReady(true);
          setCopy();
          opts.current.onReady?.();
        }, reduce ? 0 : 1700);
      }
    };
    s.restart = restart;

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      if (visible) {
        const t = (now - s.t0) / 1000, { W, H, N, P } = s, R = opts.current.repelRadius, R2 = R * R;
        if (++frameNo % 30 === 0) readFg();
        s.btnP += (s.btnT - s.btnP) * 0.06;
        const currentScatter = getScatterProgress();
        const SC = currentScatter;
        s.kick = s.kick * 0.93 + Math.abs(SC - s.last) * 6; s.last = SC;
        const q = Math.min(1, SC), sweep = ((t * 0.35) % 1.6) - 0.3, m = s.mouse;
        ctx.clearRect(0, 0, W, H); gtx.clearRect(0, 0, W, H);
        ctx.fillStyle = fg; gtx.fillStyle = opts.current.accent;

        for (let i = 0; i < N; i++) {
          const o = i * 10, isT = P[o + 9] === 1;
          let tx = P[o + 4], ty = P[o + 5], k = 0.06, fl = 0;
          const local = t - P[o + 8];
          if (isT) {
            if (local > 0) {
              const d = Math.min(1, SC * (0.8 + P[o + 8] * 0.6));
              tx = P[o + 6] + (P[o + 4] - P[o + 6]) * d; ty = P[o + 7] + (P[o + 5] - P[o + 7]) * d;
              k = Math.min(0.09, 0.02 + local * 0.08);
            }
            fl = local > -1 ? Math.max(0, 1 - Math.max(0, local) * 1.4) : 0;
          }
          if (s.kick > 0.01) fl = Math.max(fl, Math.min(1, s.kick) * 0.9);

          if (reduce) {
            const d = isT ? 1 - q : 0;
            P[o] = P[o + 4] + ((isT ? P[o + 6] : P[o + 4]) - P[o + 4]) * d;
            P[o + 1] = P[o + 5] + ((isT ? P[o + 7] : P[o + 5]) - P[o + 5]) * d;
          } else {
            let ax = (tx - P[o]) * k, ay = (ty - P[o + 1]) * k;
            if (fl > 0) { const a = FLOW(P[o], P[o + 1], t); ax += Math.cos(a) * 2.2 * fl; ay += Math.sin(a) * 2.2 * fl; }
            if (m.on && R > 0) {
              const dx = P[o] - m.x, dy = P[o + 1] - m.y, d2 = dx * dx + dy * dy;
              if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 6; ax += (dx / d) * f; ay += (dy / d) * f; }
            }
            P[o + 2] = (P[o + 2] + ax) * 0.82; P[o + 3] = (P[o + 3] + ay) * 0.82;
            P[o] += P[o + 2]; P[o + 1] += P[o + 3];
          }

          const x = P[o], y = P[o + 1], sp = Math.abs(P[o + 2]) + Math.abs(P[o + 3]);
          const gridA = Math.min(0.5, 0.12 + sp * 0.05);
          if (isT) {
            const settle = reduce ? 1 - q : Math.min(1, Math.max(0, local * 1.2)) * (1 - q);
            const a = (0.34 + settle * 0.6) * (1 - q) + gridA * q, r = 1 - q * 0.25;
            ctx.globalAlpha = a; ctx.fillRect(x - r, y - r, r * 2, r * 2);
            if (q < 1 && !reduce) {
              const w = Math.max(0, 1 - Math.abs(x / W - sweep) * 7), ga = (w * 0.9 + (1 - settle) * 0.25) * (1 - q);
              if (ga > 0.02) { gtx.globalAlpha = ga; gtx.fillRect(x - 2, y - 2, 4, 4); }
            }
          } else {
            ctx.globalAlpha = gridA; ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
          }
        }
        ctx.globalAlpha = 1; gtx.globalAlpha = 1;
        setCopy();
      }
      raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      if (!scrollScatter || !outerRef.current) return;
      const r = outerRef.current.getBoundingClientRect();
      s.scrollP = Math.min(1, Math.max(0, -r.top / (window.innerHeight * 0.7)));
      setCopy();
    };

    const move = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      s.mouse.x = e.clientX - r.left; s.mouse.y = e.clientY - r.top; s.mouse.on = true;
      spotRef.current?.style.setProperty("--x", `${s.mouse.x}px`);
      spotRef.current?.style.setProperty("--y", `${s.mouse.y}px`);
    };
    const leave = () => { s.mouse.on = false; };

    let rt = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => { build(); s.t0 = performance.now() - 3000; }, 150);
    });
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });

    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    const fontReady = document.fonts?.load
      ? document.fonts.load(`${opts.current.fontWeight} 100px ${opts.current.fontFamily}`).catch(() => [])
      : Promise.resolve([]);
    fontReady.then(() => {
      if (!alive) return;
      restart(); onScroll();
      ro.observe(stage); io.observe(stage);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      alive = false; cancelAnimationFrame(raf); window.clearTimeout(readyTimer); window.clearTimeout(rt);
      ro.disconnect(); io.disconnect();
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
    };
  }, [headline, fontFamily, fontWeight, grid[0], grid[1], scrollScatter]);

  const fade = `transition-[opacity,transform] duration-1000 [transition-timing-function:cubic-bezier(.2,.9,.25,1)] ${ready ? "translate-y-0 opacity-100" : "translate-y-2.5 opacity-0"}`;

  return (
    <section
      ref={outerRef}
      className={`relative w-full bg-[#0B0F17] text-white ${className}`}
      style={{ height: scrollScatter ? "calc(100svh + 90vh)" : "100%", ...style }}
      {...rest}
    >
      <div
        ref={stageRef}
        className="group sticky top-0 h-[100svh] min-h-[560px] w-full overflow-hidden"
        style={{ fontFamily }}
      >
        <canvas
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-60 mix-blend-screen blur-[10px]"
        />
        <canvas ref={dotsRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <div
          ref={spotRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(260px circle at var(--x,50%) var(--y,40%), color-mix(in oklab, ${accent} 16%, transparent), transparent 70%)` }}
        />

        <h1 className="sr-only">{headline}</h1>

        <div ref={copyRef} className="pointer-events-none absolute inset-0">
          {eyebrow && (
            <div className={`absolute inset-x-0 top-[12vh] flex justify-center ${fade}`}>
              <span className="inline-flex h-[30px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[13px] font-medium tracking-[-0.01em] text-[#888baa] backdrop-blur-md">
                <i className="size-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
                {eyebrow}
              </span>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-end px-5 pb-[max(17vh,110px)] text-center">
            {description && (
              <p className={`m-0 max-w-[600px] text-[17px] leading-[25px] tracking-[-0.02em] text-[#888baa] ${fade} delay-100`}>
                {description}
              </p>
            )}
            {actions && <div className={`pointer-events-auto mt-[22px] flex flex-wrap justify-center gap-2.5 ${fade} delay-200`}>{actions}</div>}
          </div>
        </div>

        {scrollScatter && scrollHint && (
          <div
            ref={hintRef}
            aria-hidden="true"
            data-up="false"
            className="group/hint pointer-events-none absolute bottom-[22px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[12px] font-medium tracking-[0.02em] text-[#888baa] opacity-0 transition-opacity duration-700"
          >
            <div className="relative h-[34px] w-[22px] rounded-[11px] border-[1.5px] border-white/20 transition-transform duration-500 group-data-[up=true]/hint:rotate-180">
              <span
                className="absolute left-1/2 top-[7px] -ml-[1.5px] h-[7px] w-[3px] rounded-sm motion-safe:animate-[dotfield-wheel_1.8s_cubic-bezier(.6,0,.3,1)_infinite]"
                style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
              />
            </div>
            <span ref={hintLabelRef}>{scrollHint.scatter}</span>
          </div>
        )}
        <style>{`@keyframes dotfield-wheel{0%{transform:translateY(0);opacity:0}20%{opacity:1}70%{transform:translateY(10px);opacity:0}100%{opacity:0}}`}</style>
      </div>
    </section>
  );
});

export default DotField;
