/**
 * SVG Generator / SVG 生成器
 * Deterministic hand-drawn fallback line-art for wishes, one recognizable
 * VIGNETTE per domain — a small scene with foreground / midground / far
 * background layers, whisper-light texture, and one gently animated element.
 * Used when the AI illustrator is unavailable (e.g. API error / no credit).
 *
 * 根据领域生成手绘风兜底线稿。每个领域一个"能认出的小场景",带前中后景层次、
 * 轻微笔触质感与一处缓慢动效。AI 画图不可用时(报错 / 欠费)回退到这里。
 *
 * Depth palette (shared with the AI prompt so app-made and AI-made match):
 *   foreground / hero  #2E2B33  width 2.3–2.6
 *   midground support  #6B5C8E  width 1.6–1.8
 *   far bg + texture   #B5A8D0  width 1.2–1.4, low opacity
 */

import { WishDomain, WishMood } from './types';

// SVG generation result
export type GeneratedSVG = {
  viewBox: string;
  paths: SVGPathData[];
  decorations: SVGDecoration[];
  animations: SVGAnimation[];
  background?: string;
};

type SVGPathData = {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
  animation?: string;
};

type SVGDecoration = {
  type: 'circle' | 'rect' | 'ellipse' | 'path';
  props: Record<string, string | number>;
  animation?: string;
};

type SVGAnimation = {
  name: string;
  keyframes: string;
};

// Seeded random number generator for consistent results
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Generate a seed from string
function stringToSeed(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = ((seed << 5) - seed) + str.charCodeAt(i);
    seed = seed & seed; // Convert to 32bit integer
  }
  return Math.abs(seed);
}

// ── Drawing helpers ────────────────────────────────────────────────
const INK = '#2E2B33';   // hero / foreground
const WISH = '#6B5C8E';  // midground support
const SOFT = '#B5A8D0';  // far background + texture

function path(d: string, stroke = INK, strokeWidth = 2.2, opacity = 0.88, animation?: string): SVGPathData {
  return { d, stroke, strokeWidth, fill: 'none', opacity, animation };
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
}

// A small gestural stick figure — head, curved body, arms, legs.
function person(x: number, y: number, scale = 1): SVGPathData[] {
  const head = circlePath(x, y - 18 * scale, 6 * scale);
  const body = `M ${x} ${y - 12 * scale} Q ${x - 2 * scale} ${y + 2 * scale} ${x} ${y + 16 * scale}`;
  const arms = `M ${x - 14 * scale} ${y - 2 * scale} Q ${x} ${y + 6 * scale} ${x + 14 * scale} ${y - 2 * scale}`;
  const legs = `M ${x} ${y + 16 * scale} Q ${x - 8 * scale} ${y + 28 * scale} ${x - 12 * scale} ${y + 34 * scale} M ${x} ${y + 16 * scale} Q ${x + 8 * scale} ${y + 28 * scale} ${x + 12 * scale} ${y + 34 * scale}`;
  return [path(head, INK, 1.7), path(body, INK, 1.7), path(arms, WISH, 1.4), path(legs, INK, 1.4)];
}

// A five-pointed star centered at (cx, cy), radius r
function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

function generateConcreteWishSVG(domain: WishDomain, random: () => number): GeneratedSVG {
  const wobble = Math.round((random() - 0.5) * 6);
  // Amplitudes tuned to be visible at card size — a 4px drift over 10s reads
  // as static; ~12px over ~5s reads as "alive" while staying low-stimulation.
  const commonAnimations: SVGAnimation[] = [
    { name: 'softDrift', keyframes: '0%, 100% { transform: translateX(0); } 50% { transform: translateX(-14px); }' },
    { name: 'softFloat', keyframes: '0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(-1.2deg); }' },
  ];
  const drift = 'softDrift 7s ease-in-out infinite';
  const floaty = 'softFloat 5s ease-in-out infinite';

  const byDomain: Record<WishDomain, GeneratedSVG> = {
    // 家人 — a cozy home with a tree, chimney smoke, and the family outside
    '家人': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 34 126 Q 104 104 176 120 T 334 116', SOFT, 1.3, 0.5, drift),      // far hills
        path('M 248 58 q 6 -6 12 0 M 261 58 q 6 -6 12 0', SOFT, 1.2, 0.6),         // birds
        path('M 52 172 Q 160 166 250 172 T 356 170', INK, 2.3),                    // ground
        path('M 92 172 L 92 116 L 132 86 L 172 116 L 172 172 Z', INK, 2.4),        // house
        path('M 116 172 L 116 138 L 140 138 L 140 172', INK, 1.8),                 // door
        path(circlePath(136, 156, 1.4), INK, 1.4),                                 // knob
        path('M 146 126 L 164 126 L 164 144 L 146 144 Z M 155 126 L 155 144 M 146 135 L 164 135', WISH, 1.4), // window
        path('M 150 96 L 150 80 L 160 80 L 160 100', INK, 1.6),                    // chimney
        path('M 155 78 Q 148 70 154 62 Q 160 54 153 46', SOFT, 1.3, 0.7, floaty),  // smoke
        path('M 198 172 L 198 148', WISH, 1.8),                                    // tree trunk
        path('M 198 150 Q 178 146 182 126 Q 196 138 208 124 Q 220 142 204 154', WISH, 1.6, 0.85), // foliage
        ...person(236, 150, 0.8),
        ...person(266, 152, 0.72),
        ...person(292, 153, 0.64),
        path('M 96 178 L 170 178 M 226 179 L 300 179', SOFT, 1.2, 0.5),            // shadows
        path('M 66 172 l -3 -7 M 74 173 l 2 -7 M 330 171 l 3 -7 M 340 172 l -2 -7', WISH, 1.2, 0.65), // grass
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 事业 — a small city block, rising chart, flag, drifting clouds
    '事业': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 42 132 L 42 106 L 64 106 L 64 132 M 300 132 L 300 94 L 322 94 L 322 132', SOFT, 1.3, 0.5), // far towers
        path('M 250 66 Q 268 54 288 64 Q 306 56 320 70', SOFT, 1.4, 0.55, floaty), // clouds
        path('M 96 66 q 6 -6 12 0 M 109 66 q 6 -6 12 0', SOFT, 1.2, 0.6),          // birds
        path('M 56 168 L 344 168', INK, 2.3),                                      // ground
        path('M 150 168 L 150 84 L 250 84 L 250 168', INK, 2.4),                   // main tower
        path('M 104 168 L 104 116 L 150 116', WISH, 1.8, 0.85),                    // left building
        path('M 250 104 L 296 104 L 296 168', WISH, 1.8, 0.85),                    // right building
        path('M 164 100 l 16 0 M 190 100 l 16 0 M 216 100 l 16 0 M 164 120 l 16 0 M 190 120 l 16 0 M 216 120 l 16 0 M 164 140 l 16 0 M 190 140 l 16 0 M 216 140 l 16 0', WISH, 1.3, 0.6), // windows
        path(`M 200 84 L 200 58 L ${224 + wobble} 64 L 200 70`, WISH, 1.8),        // roof flag
        path('M 66 152 L 92 132 L 108 140 L 132 112 M 122 112 L 134 112 L 134 122', INK, 2, 0.85), // rising chart
        path('M 106 174 L 296 174', SOFT, 1.2, 0.5),                               // shadow
        path('M 64 168 l 8 0 M 320 168 l 8 0', WISH, 1.2, 0.6),                     // ground ticks
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 钱 — savings as a growing tree with deep roots (not coins), sun, hills
    '钱': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 34 138 Q 120 120 210 134 T 360 130', SOFT, 1.3, 0.5, drift),       // far hills
        path(circlePath(312, 64, 16), WISH, 1.6, 0.8),                             // sun
        path('M 312 42 L 312 36 M 334 54 L 340 50 M 290 54 L 284 50', WISH, 1.2, 0.7), // rays
        path('M 48 168 L 352 168', INK, 2.3),                                      // ground
        path('M 196 168 L 199 118 M 199 130 Q 190 118 179 116 M 201 142 Q 214 132 226 134', INK, 2.5), // trunk + branches
        path('M 205 104 Q 172 96 172 68 Q 172 44 200 46 Q 208 30 230 42 Q 256 40 250 68 Q 258 92 224 100 Q 214 108 205 104 Z', WISH, 1.8, 0.85), // canopy
        path('M 190 66 Q 208 76 226 66 M 198 84 Q 214 92 230 82', SOFT, 1.2, 0.6), // canopy texture
        path('M 197 168 Q 186 178 176 187 M 199 168 Q 210 180 222 187 M 198 168 L 198 190', SOFT, 1.3, 0.55), // roots
        path('M 150 168 L 150 156 M 150 160 Q 144 156 142 150 M 150 160 Q 156 156 158 150', WISH, 1.4, 0.75), // seedling L
        path('M 252 168 L 252 158 M 252 161 Q 246 157 244 151 M 252 161 Q 258 157 260 151', WISH, 1.4, 0.7),  // seedling R
        path('M 262 96 Q 270 104 266 112', SOFT, 1.3, 0.6, floaty),                // falling leaf
        path('M 168 174 L 234 174', SOFT, 1.2, 0.5),                               // shadow
        path('M 60 168 l 3 -7 M 70 169 l -2 -7 M 330 168 l -3 -7 M 340 169 l 2 -7', WISH, 1.2, 0.65), // grass
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 健康 — an active figure jogging a winding path through nature, faint pulse in the sky
    '健康': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 32 130 Q 110 110 186 126 T 340 122', SOFT, 1.3, 0.5, drift),       // far hills
        path(circlePath(306, 60, 15), WISH, 1.6, 0.8),                             // sun
        path('M 306 40 L 306 34 M 326 50 L 332 46 M 286 50 L 280 46', WISH, 1.2, 0.7), // rays
        path('M 60 86 L 92 86 L 100 70 L 110 102 L 120 86 L 150 86', SOFT, 1.4, 0.55), // faint heartbeat
        path('M 40 180 Q 132 170 194 152 Q 252 134 360 142', INK, 2.4),            // winding path (upper edge)
        path('M 42 188 Q 134 178 196 160 Q 254 142 360 150', SOFT, 1.3, 0.55),     // path lower edge
        path(circlePath(150, 110, 6.5), INK, 2),                                   // jogger head
        path('M 150 116 L 148 138', INK, 2.2),                                     // torso
        path('M 149 122 L 136 118 M 149 122 L 163 128', INK, 2),                    // arms swinging
        path('M 148 138 L 138 151 L 132 162 M 148 138 L 160 150 L 168 158', INK, 2), // legs striding
        path('M 210 152 L 210 142 M 210 146 Q 204 142 202 136 M 210 146 Q 216 142 218 136', WISH, 1.5, 0.8), // sprout
        path('M 250 142 Q 262 130 276 136 Q 270 152 252 148 Z', WISH, 1.6, 0.75, floaty), // leaf
        path('M 236 60 q 6 -6 12 0 M 249 60 q 6 -6 12 0', SOFT, 1.2, 0.6),         // birds
        path('M 132 165 L 172 163', SOFT, 1.2, 0.5),                               // shadow
        path('M 80 173 l 3 -6 M 100 169 l -2 -6 M 284 138 l 2 -6 M 304 140 l -2 -6', WISH, 1.2, 0.6), // grass
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 创造 — an artist's desk: open book, pen with a flowing line lifting into stars, plant
    '创造': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 40 150 L 360 150', SOFT, 1.3, 0.5),                                // desk line
        path(starPath(302, 72, 13), WISH, 1.5, 0.78, floaty),                      // big star
        path('M 266 46 l 0 9 M 261 50 l 9 0', SOFT, 1.2, 0.6),                      // small star
        path('M 332 96 l 0 7 M 329 99 l 7 0', SOFT, 1.2, 0.55),                     // small star
        path('M 116 150 L 116 96 Q 178 116 240 96 L 240 150 Q 178 132 116 150 Z', INK, 2.3), // open book
        path('M 178 106 L 178 142 M 138 112 Q 158 120 176 112 M 138 128 Q 158 136 176 128 M 182 112 Q 200 120 218 112 M 182 128 Q 200 136 218 128', WISH, 1.4, 0.72), // spine + text
        path('M 250 150 L 300 106 L 309 114 L 259 158 Z', INK, 1.9),               // pen
        path('M 250 150 L 259 158', INK, 1.6),                                     // pen tip
        path('M 300 106 Q 291 86 306 72 Q 315 62 302 60', WISH, 1.6, 0.8),         // flowing creative line
        path('M 90 150 L 90 138 Q 90 132 98 132 L 108 132 Q 116 132 116 138 L 116 150', INK, 1.8), // inkwell
        path('M 320 150 L 320 140 L 338 140 L 338 150 M 329 140 L 329 128 M 329 132 Q 322 128 320 121 M 329 132 Q 336 128 338 121', WISH, 1.5, 0.8), // plant
        path('M 116 154 L 240 154', SOFT, 1.2, 0.5),                               // shadow
        path('M 60 150 l 12 0 M 160 154 l 14 0 M 280 150 l 12 0', SOFT, 1.2, 0.45), // desk grain
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 生活 — a little lane: near house + far house (depth), tree, winding path, sun
    '生活': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 32 128 Q 116 108 200 124 T 356 120', SOFT, 1.3, 0.5, drift),       // far hills
        path(circlePath(320, 58, 14), WISH, 1.6, 0.8),                             // sun
        path('M 48 174 L 352 174', INK, 2.3),                                      // ground
        path('M 152 174 Q 172 160 202 156 Q 242 150 302 152', SOFT, 1.4, 0.6),     // lane
        path('M 78 174 L 78 118 L 120 86 L 162 118 L 162 174 Z', INK, 2.4),        // near house
        path('M 100 174 L 100 144 L 122 144 L 122 174 M 132 128 L 150 128 L 150 144 L 132 144 Z', WISH, 1.5), // door + window
        path('M 138 96 L 138 82 L 148 82 L 148 102', INK, 1.5),                    // chimney
        path('M 143 80 Q 137 72 143 64 Q 149 56 142 48', SOFT, 1.3, 0.7, floaty),  // smoke
        path('M 236 174 L 236 130 L 268 108 L 300 130 L 300 174 Z', WISH, 1.8, 0.85), // far house
        path('M 260 174 L 260 148 L 278 148 L 278 174', WISH, 1.5, 0.8),           // far door
        path('M 200 174 L 200 150', WISH, 1.8),                                    // tree trunk
        path('M 200 152 Q 182 148 186 130 Q 198 140 208 128 Q 218 144 204 154', WISH, 1.6, 0.85), // foliage
        path('M 250 60 q 6 -6 12 0 M 263 60 q 6 -6 12 0', SOFT, 1.2, 0.6),         // birds
        path('M 82 180 L 158 180 M 240 180 L 298 180', SOFT, 1.2, 0.5),            // shadows
        path('M 60 174 l 3 -7 M 340 174 l -3 -7', WISH, 1.2, 0.6),                 // grass
      ],
      decorations: [],
      animations: commonAnimations,
    },

    // 爱 — two figures close on a hill under a tree, a heart floating, sun
    '爱': {
      viewBox: '0 0 400 220',
      paths: [
        path('M 32 132 Q 116 112 200 128 T 356 124', SOFT, 1.3, 0.5, drift),       // far hills
        path(circlePath(64, 60, 14), WISH, 1.6, 0.8),                              // sun
        path('M 40 172 Q 200 158 360 172', INK, 2.3),                              // hill
        path('M 300 172 L 300 128', INK, 2.3),                                     // tree trunk
        path('M 300 130 Q 262 120 264 84 Q 266 58 300 62 Q 312 44 336 58 Q 360 62 352 92 Q 348 118 306 124 Q 302 130 300 130 Z', WISH, 1.8, 0.85), // canopy
        path('M 288 82 Q 306 92 324 82 M 296 100 Q 312 108 328 100', SOFT, 1.2, 0.6), // canopy texture
        ...person(158, 150, 0.86),
        ...person(190, 150, 0.86),
        path('M 172 138 Q 176 132 180 138', WISH, 1.5),                            // linked
        path('M 176 100 C 168 90 152 94 152 108 C 152 122 176 134 176 134 C 176 134 200 122 200 108 C 200 94 184 90 176 100 Z', WISH, 1.5, 0.7, floaty), // heart
        path('M 110 66 q 6 -6 12 0 M 123 66 q 6 -6 12 0', SOFT, 1.2, 0.6),         // birds
        path('M 90 172 L 90 162 M 90 166 Q 84 162 82 156 M 90 166 Q 96 162 98 156', WISH, 1.4, 0.75), // flower
        path(circlePath(90, 154, 2.6), SOFT, 1.3, 0.7),                            // flower head
        path('M 144 176 L 206 176', SOFT, 1.2, 0.5),                               // shadow
        path('M 240 170 l -2 -6 M 258 170 l 2 -6', WISH, 1.2, 0.6),                // grass
      ],
      decorations: [],
      animations: commonAnimations,
    },
  };

  return byDomain[domain];
}

/**
 * Generate a deterministic fallback SVG scene for a wish.
 * `mood` is accepted for call-site compatibility; the scene is chosen by domain,
 * and `seed` keeps tiny per-wish variation stable across renders.
 */
export function generateWishSVG(
  domain: WishDomain,
  mood: WishMood = '平静',
  seed?: string
): GeneratedSVG {
  const numericSeed = seed ? stringToSeed(seed) : 1;
  const random = seededRandom(numericSeed);
  return generateConcreteWishSVG(domain, random);
}

/**
 * Render GeneratedSVG to SVG string (for server-side rendering or export)
 */
export function renderSVGToString(svg: GeneratedSVG): string {
  const styleBlock = svg.animations
    .map(a => `@keyframes ${a.name} { ${a.keyframes} }`)
    .join('\n');

  const pathElements = svg.paths
    .map(p => {
      const style = p.animation ? `animation: ${p.animation};` : '';
      const dashArray = p.animation?.includes('Draw') ? 'stroke-dasharray: 1000;' : '';
      return `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" opacity="${p.opacity}" style="${style} ${dashArray}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');

  const decorationElements = svg.decorations
    .map(d => {
      const style = d.animation ? `animation: ${d.animation};` : '';
      const props = Object.entries(d.props)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${d.type} ${props} style="${style}"/>`;
    })
    .join('\n');

  return `<svg viewBox="${svg.viewBox}" xmlns="http://www.w3.org/2000/svg">
  <style>${styleBlock}</style>
  <g>
    ${pathElements}
    ${decorationElements}
  </g>
</svg>`;
}

/**
 * Get SVG as React-compatible props
 */
export function getSVGProps(svg: GeneratedSVG) {
  return {
    viewBox: svg.viewBox,
    paths: svg.paths,
    decorations: svg.decorations,
    animations: svg.animations,
  };
}
