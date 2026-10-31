'use client';

import { useEffect, useRef } from "react";

export interface DataRainPalette {
  calm: string;
  mid: string;
  hot: string;
}

export interface DataRainProps {
  className?: string;
  count?: number;
  flowSpeed?: number;
  obstacleRadius?: number;
  autopilot?: boolean;
  fullscreen?: boolean;
  palette?: DataRainPalette;
}

interface EngineApi {
  refresh: () => void;
}

type RGB = readonly [number, number, number];

const MAX = 7000;
const L = 19;
const STEP = 1 / 60;
const PUFFS = 32;
const TAU = Math.PI * 2;
const AGE_BUCKETS = 6;
const SEGS_PER_BUCKET = 3;

const DEFAULT_CALM: RGB = [163, 230, 53];  // StudySync Lime Accent (#a3e635)
const DEFAULT_MID: RGB = [34, 230, 255];   // Cyber Cyan (#22e6ff)
const DEFAULT_HOT: RGB = [255, 61, 154];   // Sparkle Magenta (#ff3d9a)
const DEFAULT_CORE: RGB = [234, 252, 255];

// Boosted alpha and width for vivid, crisp visibility on dark backgrounds
const BASE_ALPHA = [0.45, 0.65, 0.9];
const BASE_WIDTH = [0.9, 1.2, 1.6];
const ALPHA_GAIN = 1.6;
const HEAD_WIDTH = 2.0;

const K_RELAX = 1 - Math.exp(-STEP / 0.12);
const K_Q = 1 - Math.exp(-STEP * 8);
const K_CURSOR = 1 - Math.exp(-STEP * 18);
const K_VEL = 1 - Math.exp(-STEP * 10);
const K_IN = 1 - Math.exp(-STEP / 0.06);
const K_OUT = 1 - Math.exp(-STEP / 0.2);
const FIRE_P = 0.03 * STEP;
const FIRE_DECAY = Math.exp(-STEP / 0.45);
const PUFF_DECAY = Math.exp(-STEP / 1.1);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHex(input: string | undefined, fallback: RGB): RGB {
  if (!input) return fallback;
  let s = input.trim().replace(/^#/, "");
  if (s.length === 3) {
    s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return fallback;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Wave {
  kx: number;
  ky: number;
  om: number;
  ph: number;
  au: number;
  av: number;
}

function makeWave(lambda: number, angle: number, omega: number, phase: number, amp: number): Wave {
  const k = TAU / lambda;
  return {
    kx: k * Math.cos(angle),
    ky: k * Math.sin(angle),
    om: omega,
    ph: phase,
    au: amp * Math.sin(angle),
    av: -amp * Math.cos(angle),
  };
}

const WAVE_0 = makeWave(380, 0.35, 0.18, 0.7, 16);
const WAVE_1 = makeWave(620, 1.9, 0.27, 2.1, 13);
const WAVE_2 = makeWave(900, 3.4, 0.35, 4.2, 10);

export default function DataRain(props: DataRainProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef<DataRainProps>(props);
  const apiRef = useRef<EngineApi | null>(null);
  propsRef.current = props;

  useEffect(() => {
    const root = rootRef.current;
    const main = mainRef.current;
    const bloom = bloomRef.current;
    if (!root || !main || !bloom) return undefined;
    const ctx = main.getContext("2d");
    const bctx = bloom.getContext("2d");
    if (!ctx || !bctx) return undefined;

    // Do not freeze animation on Windows if OS has reduced-motion preference
    const reduced = false;
    const rand = mulberry32(7);

    let disposed = false;
    let initialised = false;
    let live = false;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let bw = 1;
    let bh = 1;

    const px = new Float32Array(MAX);
    const py = new Float32Array(MAX);
    const vx = new Float32Array(MAX);
    const vy = new Float32Array(MAX);
    const pz = new Float32Array(MAX);
    const v0 = new Float32Array(MAX);
    const qv = new Float32Array(MAX);
    const fire = new Float32Array(MAX);
    const len = new Uint8Array(MAX);
    const hx = new Float32Array(MAX * L);
    const hy = new Float32Array(MAX * L);
    let head = 0;

    const groupList: Int32Array[] = [];
    for (let g = 0; g < 6; g++) groupList.push(new Int32Array(MAX));
    const groupCount = new Int32Array(6);

    const strokeStyles: string[] = new Array<string>(6 * AGE_BUCKETS).fill("");
    const strokeWidths = new Float32Array(6 * AGE_BUCKETS);
    const headStyles: string[] = ["", ""];
    let haloGradient: CanvasGradient | null = null;

    const pX = new Float32Array(PUFFS);
    const pY = new Float32Array(PUFFS);
    const pGamma = new Float32Array(PUFFS);
    const pAge = new Float32Array(PUFFS);
    const pAlive = new Uint8Array(PUFFS);
    const aX = new Float32Array(PUFFS);
    const aY = new Float32Array(PUFFS);
    const aG = new Float32Array(PUFFS);
    const aC2 = new Float32Array(PUFFS);
    const aR2 = new Float32Array(PUFFS);
    let aCount = 0;
    let puffCursor = 0;
    let shedSign = 1;
    let shedAcc = 0;

    let simTime = 0;
    let liveTime = 0;
    let active = 0;
    let targetCount = 0;
    let quality = 1;

    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;
    let idleSince = 0;
    let idleDelay = 1.2;
    let prevSrc = 0;
    let tgtX = 0;
    let tgtY = 0;
    let cx = 0;
    let cy = 0;
    let pcx = 0;
    let pcy = 0;
    let vcx = 0;
    let vcy = 0;
    let influence = 0;
    let curA = 64;

    let raf = 0;
    let last = 0;
    let acc = 0;
    let frameEma = 16.7;
    let workEma = 4;
    let slowFrames = 0;
    let fastFrames = 0;

    const buildStyles = (): void => {
      const cs = getComputedStyle(root);
      const pal = propsRef.current.palette;
      const calm = parseHex(pal?.calm ?? cs.getPropertyValue("--dr-calm"), DEFAULT_CALM);
      const mid = parseHex(pal?.mid ?? cs.getPropertyValue("--dr-mid"), DEFAULT_MID);
      const hot = parseHex(pal?.hot ?? cs.getPropertyValue("--dr-hot"), DEFAULT_HOT);
      const core = parseHex(cs.getPropertyValue("--dr-core"), DEFAULT_CORE);
      const colours: RGB[] = [calm, mid, hot];

      for (let g = 0; g < 6; g++) {
        const depth = g < 3 ? 0 : 1;
        const bucket = g % 3;
        const c = colours[bucket];
        for (let ab = 0; ab < AGE_BUCKETS; ab++) {
          const falloff = Math.pow(1 - (ab + 0.5) / AGE_BUCKETS, 1.5);
          const alpha = Math.min(
            0.98,
            BASE_ALPHA[bucket] * (depth === 0 ? 0.65 : 1) * falloff * ALPHA_GAIN,
          );
          strokeStyles[g * AGE_BUCKETS + ab] = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
          const width =
            BASE_WIDTH[bucket] * (depth === 0 ? 0.8 : 1) * (1 - (0.45 * ab) / AGE_BUCKETS);
          strokeWidths[g * AGE_BUCKETS + ab] = clamp(width, 0.8, 1.8);
        }
      }
      headStyles[0] = `rgba(${core[0]},${core[1]},${core[2]},0.7)`;
      headStyles[1] = `rgba(${core[0]},${core[1]},${core[2]},0.95)`;

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},1)`);
      grad.addColorStop(0.45, `rgba(${hot[0]},${hot[1]},${hot[2]},0.4)`);
      grad.addColorStop(1, `rgba(${hot[0]},${hot[1]},${hot[2]},0)`);
      haloGradient = grad;
    };

    const seedParticle = (i: number, uniform: boolean): void => {
      let x: number;
      let y: number;
      if (uniform) {
        x = rand() * w;
        y = rand() * h;
      } else {
        x = -40 + rand() * (w + 80);
        y = -40 - rand() * 80;
      }
      const z = 0.35 + 0.65 * rand();
      const nominal = 70 + 90 * z * z;
      const flow = clamp(propsRef.current.flowSpeed ?? 1, 0.05, 5);
      pz[i] = z;
      v0[i] = nominal;
      len[i] = 9 + Math.floor(rand() * 11);
      px[i] = x;
      py[i] = y;
      vx[i] = 0;
      vy[i] = nominal * flow;
      qv[i] = 1;
      fire[i] = 0;
      const base = i * L;
      for (let k = 0; k < L; k++) {
        hx[base + k] = x;
        hy[base + k] = y;
      }
    };

    const seedAll = (): void => {
      for (let i = 0; i < MAX; i++) seedParticle(i, true);
    };

    const setActive = (n: number, uniform: boolean): void => {
      const next = clamp(Math.round(n), 1, MAX);
      for (let i = active; i < next; i++) seedParticle(i, uniform);
      active = next;
    };

    const applyCount = (uniform: boolean): void => {
      const auto = clamp(Math.round((w * h) / 520), 1200, 5200);
      const requested = propsRef.current.count;
      targetCount = clamp(Math.round(requested !== undefined ? requested : auto), 1, MAX);
      setActive(targetCount * quality, uniform);
    };

    const spawnPuff = (a: number, speed: number): void => {
      const dxn = vcx / speed;
      const dyn = vcy / speed;
      const sign = shedSign;
      shedSign = -shedSign;
      const j = puffCursor;
      puffCursor = (puffCursor + 1) % PUFFS;
      pX[j] = cx - dxn * 0.6 * a - dyn * sign * 0.7 * a;
      pY[j] = cy - dyn * 0.6 * a + dxn * sign * 0.7 * a;
      pGamma[j] = clamp(sign * Math.min(speed, 1200) * a * 1.5, -105000, 105000);
      pAge[j] = 0;
      pAlive[j] = 1;
    };

    const simulate = (): void => {
      const p = propsRef.current;
      const flow = clamp(p.flowSpeed ?? 1, 0.05, 5);
      const obsR = p.obstacleRadius ?? 64;
      const autopilotOn = p.autopilot ?? true;

      head = (head + 1) % L;
      simTime += STEP;
      if (live) liveTime += STEP;

      const ghostOn = autopilotOn && !pointerActive && live && liveTime - idleSince >= idleDelay;
      const src = pointerActive ? 2 : ghostOn ? 1 : 0;
      if (src === 1) {
        tgtX = w * (0.5 + 0.32 * Math.sin(0.37 * liveTime));
        tgtY = h * (0.5 + 0.28 * Math.sin(0.53 * liveTime + 1.2));
      } else if (src === 2) {
        tgtX = pointerX;
        tgtY = pointerY;
      }
      const snap = src !== 0 && prevSrc === 0 && influence < 0.05;
      prevSrc = src;

      if (snap) {
        cx = tgtX;
        cy = tgtY;
        pcx = cx;
        pcy = cy;
        vcx = 0;
        vcy = 0;
      } else {
        pcx = cx;
        pcy = cy;
        cx += (tgtX - cx) * K_CURSOR;
        cy += (tgtY - cy) * K_CURSOR;
        vcx += ((cx - pcx) / STEP - vcx) * K_VEL;
        vcy += ((cy - pcy) / STEP - vcy) * K_VEL;
      }

      influence += ((src !== 0 ? 1 : 0) - influence) * (src !== 0 ? K_IN : K_OUT);
      const infl = influence;

      const vcMag = Math.sqrt(vcx * vcx + vcy * vcy);
      const a = obsR + Math.min(vcMag * 0.025, 36);
      curA = a;

      if (infl > 0.3 && vcMag > 60) {
        const dxm = cx - pcx;
        const dym = cy - pcy;
        shedAcc += Math.sqrt(dxm * dxm + dym * dym);
        let guard = 0;
        while (shedAcc >= 28 && guard < 4) {
          shedAcc -= 28;
          guard++;
          spawnPuff(a, vcMag);
        }
        if (shedAcc >= 28) shedAcc = 0;
      } else {
        shedAcc = 0;
      }

      aCount = 0;
      const puffDrift = 0.5 * 115 * flow * STEP;
      for (let j = 0; j < PUFFS; j++) {
        if (pAlive[j] === 0) continue;
        const age = pAge[j] + STEP;
        if (age > 2.4) {
          pAlive[j] = 0;
          continue;
        }
        pAge[j] = age;
        pGamma[j] *= PUFF_DECAY;
        pY[j] += puffDrift;
        const c2 = 676 + 90 * age;
        aX[aCount] = pX[j];
        aY[aCount] = pY[j];
        aG[aCount] = pGamma[j] / TAU;
        aC2[aCount] = c2;
        aR2[aCount] = 36 * c2;
        aCount++;
      }

      const ph0 = WAVE_0.om * simTime + WAVE_0.ph;
      const ph1 = WAVE_1.om * simTime + WAVE_1.ph;
      const ph2 = WAVE_2.om * simTime + WAVE_2.ph;
      const k0x = WAVE_0.kx;
      const k0y = WAVE_0.ky;
      const k1x = WAVE_1.kx;
      const k1y = WAVE_1.ky;
      const k2x = WAVE_2.kx;
      const k2y = WAVE_2.ky;
      const a0u = WAVE_0.au;
      const a0v = WAVE_0.av;
      const a1u = WAVE_1.au;
      const a1v = WAVE_1.av;
      const a2u = WAVE_2.au;
      const a2v = WAVE_2.av;

      const obsOn = infl > 0.002;
      const projectOn = infl > 0.05;
      const projScale = Math.min(1, infl * 1.5);
      const respawnBottom = h + 40;
      const respawnRight = w + 120;

      for (let i = 0; i < active; i++) {
        const x0 = px[i];
        const y0 = py[i];
        const z = pz[i];
        const v0e = v0[i] * flow;

        const c0 = Math.cos(k0x * x0 + k0y * y0 + ph0);
        const c1 = Math.cos(k1x * x0 + k1y * y0 + ph1);
        const c2 = Math.cos(k2x * x0 + k2y * y0 + ph2);
        let tx = (a0u * c0 + a1u * c1 + a2u * c2) * z;
        let ty = v0e + (a0v * c0 + a1v * c1 + a2v * c2) * z;

        const zf = 0.55 + 0.45 * z;
        const aE = a * zf;
        const rx = x0 - cx;
        const ry = y0 - cy;

        let pertX = 0;
        let pertY = 0;
        let deficit = 0;

        if (obsOn) {
          const d2 = rx * rx + ry * ry;
          let Ux = -vcx;
          let Uy = v0e - vcy;
          let U = Math.sqrt(Ux * Ux + Uy * Uy);
          if (U > 1e-3) {
            if (U > 900) {
              const sc = 900 / U;
              Ux *= sc;
              Uy *= sc;
              U = 900;
            }
            const ex = Ux / U;
            const ey = Uy / U;
            const s = rx * ex + ry * ey;
            const n = -rx * ey + ry * ex;

            if (s > 0 && s < 12 * aE) {
              const wd = 0.9 * aE + 0.2 * s;
              const nn = n / wd;
              deficit = 0.55 * Math.exp(-s / (3 * aE)) * Math.exp(-nn * nn);
            }

            const near = 9 * aE;
            if (d2 < near * near) {
              const rho2 = Math.max(s * s + n * n, aE * aE * 0.64);
              const k = (aE * aE) / (rho2 * rho2);
              const ds = -U * k * (s * s - n * n);
              const dn = -U * k * 2 * s * n;
              let win = 1;
              const inner = 5 * aE;
              if (d2 > inner * inner) {
                const t = (Math.sqrt(d2) - inner) / (4 * aE);
                win = 1 - t * t * (3 - 2 * t);
              }
              pertX = (ds * ex - dn * ey) * win;
              pertY = (ds * ey + dn * ex) * win;
            }
          }
        }

        let vorX = 0;
        let vorY = 0;
        for (let j = 0; j < aCount; j++) {
          const dx = x0 - aX[j];
          const dy = y0 - aY[j];
          const d2p = dx * dx + dy * dy + 1e-3;
          const r2 = aR2[j];
          if (d2p < r2) {
            const f = (aG[j] * (1 - Math.exp(-d2p / aC2[j]))) / d2p;
            const wnd = 1 - d2p / r2;
            const fw = f * wnd * wnd * zf;
            vorX += -dy * fw;
            vorY += dx * fw;
          }
        }

        const keep = 1 - deficit * infl;
        tx = tx * keep + pertX * infl + vorX;
        ty = ty * keep + pertY * infl + vorY;

        let ux = vx[i] + (tx - vx[i]) * K_RELAX;
        let uy = vy[i] + (ty - vy[i]) * K_RELAX;
        const sp2 = ux * ux + uy * uy;
        if (sp2 > 810000) {
          const sc = 900 / Math.sqrt(sp2);
          ux *= sc;
          uy *= sc;
        }
        let x = x0 + ux * STEP;
        let y = y0 + uy * STEP;

        if (projectOn) {
          const aP = aE * projScale;
          const qx = x - cx;
          const qy = y - cy;
          const q2 = qx * qx + qy * qy;
          const lim = 0.98 * aP;
          if (q2 < lim * lim) {
            const rr = Math.sqrt(q2);
            const nx = rr < 1e-3 ? 0 : qx / rr;
            const ny = rr < 1e-3 ? 1 : qy / rr;
            x = cx + nx * aP;
            y = cy + ny * aP;
            const vn = (ux - vcx) * nx + (uy - vcy) * ny;
            if (vn < 0) {
              ux -= vn * nx;
              uy -= vn * ny;
            }
          }
        }

        vx[i] = ux;
        vy[i] = uy;
        px[i] = x;
        py[i] = y;

        if (y > respawnBottom || x < -120 || x > respawnRight || y < -600) {
          seedParticle(i, false);
          continue;
        }

        qv[i] += (Math.sqrt(ux * ux + uy * uy) / v0e - qv[i]) * K_Q;

        if (rand() < FIRE_P) {
          fire[i] = 1;
        } else {
          const f = fire[i] * FIRE_DECAY;
          fire[i] = f < 0.01 ? 0 : f;
        }

        const slot = i * L + head;
        hx[slot] = x;
        hy[slot] = y;
      }
    };

    const render = (): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (influence > 0.02 && haloGradient) {
        const speed = Math.sqrt(vcx * vcx + vcy * vcy);
        const r = 1.5 * curA;
        ctx.globalAlpha = Math.min(1, (0.08 + Math.min(speed / 4000, 0.1)) * influence);
        ctx.setTransform(dpr * r, 0, 0, dpr * r, dpr * cx, dpr * cy);
        ctx.fillStyle = haloGradient;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.globalAlpha = 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      groupCount.fill(0);
      for (let i = 0; i < active; i++) {
        const qq = qv[i];
        let b = qq < 1.25 ? 0 : qq < 1.85 ? 1 : 2;
        if (fire[i] > 0.35 && b < 2) b++;
        const g = (pz[i] < 0.62 ? 0 : 3) + b;
        groupList[g][groupCount[g]++] = i;
      }

      for (let g = 0; g < 6; g++) {
        const cnt = groupCount[g];
        if (cnt === 0) continue;
        const list = groupList[g];
        for (let ab = 0; ab < AGE_BUCKETS; ab++) {
          const k0 = ab * SEGS_PER_BUCKET;
          const k1 = k0 + SEGS_PER_BUCKET;
          ctx.strokeStyle = strokeStyles[g * AGE_BUCKETS + ab];
          ctx.lineWidth = strokeWidths[g * AGE_BUCKETS + ab];
          ctx.beginPath();
          for (let j = 0; j < cnt; j++) {
            const i = list[j];
            const segs = len[i] - 1;
            if (k0 >= segs) continue;
            const base = i * L;
            const kEnd = Math.min(k1, segs);
            let idx = (head - k0 + L) % L;
            ctx.moveTo(hx[base + idx], hy[base + idx]);
            for (let k = k0; k < kEnd; k++) {
              idx = idx === 0 ? L - 1 : idx - 1;
              ctx.lineTo(hx[base + idx], hy[base + idx]);
            }
          }
          ctx.stroke();
        }
      }

      const prevHead = head === 0 ? L - 1 : head - 1;
      ctx.lineWidth = HEAD_WIDTH;
      for (let depth = 0; depth < 2; depth++) {
        ctx.strokeStyle = headStyles[depth];
        ctx.beginPath();
        for (let b = 1; b < 3; b++) {
          const g = depth * 3 + b;
          const cnt = groupCount[g];
          const list = groupList[g];
          for (let j = 0; j < cnt; j++) {
            const i = list[j];
            if (b === 1 && fire[i] <= 0.5) continue;
            const base = i * L;
            ctx.moveTo(hx[base + head], hy[base + head]);
            ctx.lineTo(hx[base + prevHead], hy[base + prevHead]);
          }
        }
        ctx.stroke();
      }

      bctx.clearRect(0, 0, bw, bh);
      bctx.drawImage(main, 0, 0, bw, bh);
    };

    const presim = (seconds: number): void => {
      const n = Math.round(seconds / STEP);
      for (let s = 0; s < n; s++) simulate();
    };

    const resize = (): void => {
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const parentRect = root.parentElement?.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width || parentRect?.width || root.clientWidth || window.innerWidth));
      const nh = Math.max(1, Math.round(rect.height || parentRect?.height || root.clientHeight || window.innerHeight));
      let d = Math.min(window.devicePixelRatio || 1, 2);
      if (nw * nh * d * d > 4.5e6) d = Math.sqrt(4.5e6 / (nw * nh));
      if (nw === w && nh === h && d === dpr) return;

      w = nw;
      h = nh;
      dpr = d;
      main.width = Math.max(1, Math.round(w * dpr));
      main.height = Math.max(1, Math.round(h * dpr));
      bw = Math.max(1, Math.ceil(w / 4));
      bh = Math.max(1, Math.ceil(h / 4));
      bloom.width = bw;
      bloom.height = bh;
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = "medium";

      if (!initialised) return;

      for (let i = 0; i < active; i++) {
        if (px[i] < -120 || px[i] > w + 120 || py[i] > h + 40) seedParticle(i, false);
      }
      applyCount(true);
      render();
    };

    const onMove = (e: PointerEvent): void => {
      const r = root.getBoundingClientRect();
      pointerX = e.clientX - r.left;
      pointerY = e.clientY - r.top;
      pointerActive = true;
    };
    const onLeave = (): void => {
      if (!pointerActive) return;
      pointerActive = false;
      idleSince = liveTime;
      idleDelay = 4;
    };
    const onUp = (e: PointerEvent): void => {
      if (e.pointerType !== "mouse") onLeave();
    };

    const frame = (now: number): void => {
      if (disposed) return;
      const dtRaw = Math.max(0, now - last);
      last = now;
      acc += Math.min(0.05, dtRaw / 1000);

      const t0 = performance.now();
      let n = 0;
      while (acc >= STEP && n < 3) {
        simulate();
        acc -= STEP;
        n++;
      }
      if (n === 3) acc = 0;
      if (n > 0) render();
      const work = performance.now() - t0;

      if (dtRaw > 0 && dtRaw < 100) {
        frameEma += (dtRaw - frameEma) * 0.05;
        workEma += (work - workEma) * 0.05;
      }
      if (frameEma > 20) {
        slowFrames++;
        fastFrames = 0;
      } else if (frameEma < 18.5 && workEma < 12) {
        fastFrames++;
        slowFrames = 0;
      } else {
        slowFrames = 0;
        fastFrames = 0;
      }
      if (slowFrames >= 60 && quality > 0.4) {
        quality = Math.max(0.4, quality - 0.1);
        slowFrames = 0;
        applyCount(false);
      } else if (fastFrames >= 180 && quality < 1) {
        quality = Math.min(1, quality + 0.05);
        fastFrames = 0;
        applyCount(false);
      }

      raf = requestAnimationFrame(frame);
    };

    const start = (): void => {
      cancelAnimationFrame(raf);
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (live && !disposed) {
        start();
      }
    };

    resize();
    buildStyles();
    seedAll();
    applyCount(true);
    cx = pcx = tgtX = w * 0.5;
    cy = pcy = tgtY = h * 0.5;

    const ro = new ResizeObserver(() => resize());
    ro.observe(root);

    apiRef.current = {
      refresh: () => {
        if (disposed || !initialised) return;
        buildStyles();
        applyCount(false);
      },
    };

    presim(1.5);
    render();
    initialised = true;
    live = true;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onLeave, { passive: true });
    window.addEventListener("blur", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      disposed = true;
      live = false;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("blur", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      apiRef.current = null;
      haloGradient = null;
    };
  }, []);

  const palette = props.palette;
  useEffect(() => {
    apiRef.current?.refresh();
  }, [props.count, palette?.calm, palette?.mid, palette?.hot]);

  const fullscreen = props.fullscreen ?? true;
  const cls = [
    "dr-root pointer-events-none",
    fullscreen
      ? "fixed inset-0 -z-10"
      : "absolute inset-0 w-full h-full overflow-hidden",
    props.className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={cls}
      aria-hidden="true"
      style={{
        position: fullscreen ? "fixed" : "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        zIndex: fullscreen ? -1 : 0,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={bloomRef}
        className="dr-bloom pointer-events-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          filter: "blur(10px)",
          opacity: 0.6,
          zIndex: 0,
        }}
      />
      <canvas
        ref={mainRef}
        className="dr-main pointer-events-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      />
      <div
        className="dr-vignette pointer-events-none"
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(2,3,8,0.4) 100%)",
          zIndex: 0,
        }}
      />
    </div>
  );
}

export { DataRain };
