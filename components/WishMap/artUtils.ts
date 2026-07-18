/**
 * Map Art Utilities / 地图视觉工具
 * Deterministic generators for wobbly organic paths, starfield dust,
 * and flowing riverlines shared by StarMap and RiverMap.
 *
 * All randomness is seeded (mulberry32) so server and client render
 * identical SVG — Math.random() here would cause hydration mismatches.
 */

export type Point = { x: number; y: number };

// Mulberry32 seeded PRNG — tiny, deterministic, good enough for art
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth closed path through points (Catmull-Rom converted to cubic beziers)
export function catmullRomClosed(points: Point[]): string {
  const n = points.length;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + ' Z';
}

// Smooth open path through points
export function catmullRomOpen(points: Point[]): string {
  const n = points.length;
  if (n < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export type WobblyRing = {
  path: string;
  // Radial multiplier at angle theta — lets nodes sit exactly on the wobbly ring
  radiusAt: (theta: number) => number;
};

// Hand-drawn feeling orbit ring: an ellipse gently perturbed by two harmonics
export function makeWobblyRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number
): WobblyRing {
  const rand = mulberry32(seed);
  const f1 = 2 + Math.floor(rand() * 2); // 2-3 slow lobes
  const f2 = 5 + Math.floor(rand() * 3); // 5-7 fine ripples
  const a1 = 0.02 + rand() * 0.02;
  const a2 = 0.012 + rand() * 0.012;
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const radiusAt = (t: number) =>
    1 + a1 * Math.sin(f1 * t + p1) + a2 * Math.sin(f2 * t + p2);
  const pts: Point[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const k = radiusAt(t);
    pts.push({ x: cx + Math.cos(t) * rx * k, y: cy + Math.sin(t) * ry * k });
  }
  return { path: catmullRomClosed(pts), radiusAt };
}

export type Dust = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkle: boolean;
  duration: number; // seconds, >= 3 per design system
  delay: number;
};

// Starfield / water-light dust. Density and size stay inside DESIGN_SYSTEM §5:
// <= 1 particle / 8000px², radius <= 2.5px, opacity 0.15-0.7, <= 1/3 twinkling.
export function makeDust(
  width: number,
  height: number,
  count: number,
  seed: number,
  band?: { yAt: (x: number) => number; spread: number }
): Dust[] {
  const maxCount = Math.floor((width * height) / 8000);
  const n = Math.min(count, maxCount);
  const rand = mulberry32(seed);
  const out: Dust[] = [];
  for (let i = 0; i < n; i++) {
    const x = rand() * width;
    const y = band
      ? band.yAt(x) + (rand() * 2 - 1) * band.spread
      : rand() * height;
    out.push({
      x,
      y,
      r: 0.8 + rand() * 1.6,
      opacity: 0.15 + rand() * 0.45,
      twinkle: rand() < 0.33,
      duration: 3.5 + rand() * 3.5,
      delay: rand() * 6,
    });
  }
  return out;
}

// Truncate a wish title for map labels — CJK glyphs are twice as wide
export function truncateTitle(title: string, cjkMax: number, latinMax: number): string {
  const max = /[\u3000-\u9fff\uf900-\ufaff]/.test(title) ? cjkMax : latinMax;
  return title.length > max ? title.slice(0, max) + '…' : title;
}

export type Riverline = {
  path: string;
  yAt: (x: number) => number;
  offsetPath: (offset: number) => string;
};

// Winding horizontal river centerline across a 960-wide canvas
export function makeRiverline(height: number, seed: number): Riverline {
  const rand = mulberry32(seed);
  const amp = Math.min(52, height * 0.09);
  const phase = rand() * Math.PI * 2;
  const yAt = (x: number) =>
    height / 2 +
    amp * Math.sin((x / 960) * Math.PI * 1.5 + phase) +
    amp * 0.35 * Math.sin((x / 960) * Math.PI * 3.4 + phase * 1.7);
  const pts: Point[] = [];
  for (let x = -24; x <= 984; x += 48) {
    pts.push({ x, y: yAt(x) });
  }
  return {
    path: catmullRomOpen(pts),
    yAt,
    offsetPath: (offset: number) =>
      catmullRomOpen(pts.map((p) => ({ x: p.x, y: p.y + offset }))),
  };
}

// Iterative pairwise repulsion — wishes may drift close, but never overlap.
// Mutates the position objects in place; deterministic and cheap for small N.
export function resolveCollisions(
  points: Array<{ cx: number; cy: number }>,
  minDist: number,
  iterations = 28
): void {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          const push = (minDist - Math.max(d, 0.01)) / 2;
          const ux = d > 0.01 ? dx / d : 1;
          const uy = d > 0.01 ? dy / d : 0.3;
          a.cx -= ux * push;
          a.cy -= uy * push;
          b.cx += ux * push;
          b.cy += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}
