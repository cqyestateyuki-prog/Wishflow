/**
 * AmbientBackground / 环境氛围层
 * Three quiet layers behind the whole app (DESIGN_SYSTEM.md §1 · wobbly / alive):
 *   1. mist   — the existing soft purple radial glow, now drifting very slowly
 *   2. petals — a zero-dependency canvas of hand-drawn petals & dust motes
 *              falling with a gentle sway, in three depth bands (near/mid/far)
 *   3. grain  — a paper-noise overlay that makes the ink lines sit on paper
 * Low-stimulation rules: slow speeds, muted purples, prefers-reduced-motion
 * skips the canvas entirely, and rendering pauses while the tab is hidden.
 */

'use client';

import { useEffect, useRef } from 'react';

type Petal = {
  x: number;      // base x (px)
  y: number;
  vy: number;     // fall speed px/s
  sway: number;   // sway amplitude px
  freq: number;   // sway frequency rad/s
  phase: number;
  rot: number;    // base rotation
  rotAmp: number; // rotation wobble
  size: number;   // ~petal length px
  depth: number;  // 0 far … 1 near
  bend: number;   // frozen curve irregularity
  kind: 'petal' | 'mote';
};

const PETAL_STROKE = 'rgba(139, 123, 174, 0.55)';
const PETAL_FILL = 'rgba(181, 168, 208, 0.14)';
const MOTE_FILL = 'rgba(107, 92, 142, 0.16)';

function makePetal(w: number, h: number, spawnAnywhere: boolean): Petal {
  const depth = Math.random();
  const kind = Math.random() < 0.45 ? 'mote' : 'petal';
  return {
    x: Math.random() * w,
    y: spawnAnywhere ? Math.random() * h : -30 - Math.random() * 60,
    vy: (6 + depth * 12) * (kind === 'mote' ? 0.6 : 1),
    sway: 10 + depth * 26,
    freq: 0.25 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    rotAmp: 0.5 + Math.random() * 0.7,
    size: kind === 'mote' ? 1 + depth * 1.6 : 7 + depth * 9,
    depth,
    bend: 0.75 + Math.random() * 0.5,
    kind,
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, t: number) {
  const x = p.x + Math.sin(t * p.freq + p.phase) * p.sway;
  const y = p.y;
  const alpha = 0.3 + p.depth * 0.55;

  if (p.kind === 'mote') {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = MOTE_FILL;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const rot = p.rot + Math.sin(t * p.freq * 0.6 + p.phase) * p.rotAmp;
  const s = p.size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = PETAL_STROKE;
  ctx.fillStyle = PETAL_FILL;
  // A single hand-drawn petal: two gently-uneven bezier curves meeting at the tip.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.45 * p.bend, -s * 0.38, s * 0.95, -s * 0.18, s, 0.5);
  ctx.bezierCurveTo(s * 0.9, s * 0.3 * p.bend, s * 0.4, s * 0.34, 0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let petals: Petal[] = [];
    let w = 0;
    let h = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Gentle density: a phone gets ~10, a laptop ~26. Never a blizzard.
      const target = Math.min(26, Math.max(8, Math.round((w * h) / 42000)));
      if (petals.length === 0) {
        petals = Array.from({ length: target }, () => makePetal(w, h, true));
      } else if (petals.length > target) {
        petals.length = target;
      } else {
        while (petals.length < target) petals.push(makePetal(w, h, true));
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.vy * dt;
        if (p.y > h + 40) petals[i] = makePetal(w, h, false);
        drawPetal(ctx, petals[i], t);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div aria-hidden>
      <div className="ambient" />
      <canvas ref={canvasRef} className="ambient-petals" />
      <div className="paper-grain" />
      {/* Hand-drawn wobble filters (WishCard / PaperCard edges).
          wf-squiggle: lively, for small accents.
          wf-squiggle-soft: long slow waves — a sheet that isn't machine-cut,
          not a shredded edge. Cards use this one. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} focusable="false">
        <filter id="wf-squiggle">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
        </filter>
        <filter id="wf-squiggle-soft">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
        </filter>
      </svg>
    </div>
  );
}
