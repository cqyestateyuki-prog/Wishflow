/**
 * Home Page / 首页 — parallax scroll landing
 * Promoted from the /preview prototype (2026-07-17). Two scroll-driven scenes
 * inside a sticky viewport, all hand-drawn SVG layers in the Wishflow
 * paper-and-ink language.
 *
 * Scene 1: hero copy over a river landscape seen through a hand-drawn gate.
 * Scroll: the camera sails through the gate (scale 1→4, capped for calm),
 * mist parts like curtains, and Scene 2 rises: an arc of pinned wish cards
 * that rotates with scroll.
 *
 * Low-stimulation rules: gate zoom capped at 4×, slow easings, muted purples,
 * prefers-reduced-motion renders a static two-section page, mobile drops the
 * mouse parallax and shortens the scroll run.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../components/LanguageProvider';
import { LocalWish } from '@/lib/localStore';
import WishSpace from '@/components/WishSpace';
import PaperCard from '@/components/PaperCard';

const INK = '#2E2B33';
// Deeper than the app tokens on purpose — pale purple lines washed out on the
// big empty sheet of this page (user feedback 2026-07-10).
const WISH = '#5B4B84';

// Hero 两颗 CTA 的公共骨架 —— flex:1 让它们在同一条容器里均分宽度,
// 高度锁死 50, 次要按钮那 1px 边框用透明边框在主按钮上补齐, 两颗才真的一样大。
const ctaBase: React.CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  height: 50,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 14px',
  fontSize: 15,
  lineHeight: 1.2,
  textAlign: 'center',
  fontFamily: 'inherit',
  textDecoration: 'none',
  border: '1px solid transparent',
};
const SOFT = '#9C8CC2';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// Mouse parallax magnitudes (px at full mouse offset), spec-style.
const MAG = { sky: 4, river: 7, gate: 7, mist: 14 };

// ---------------------------------------------------------------------------
// Demo wish cards for the arc slider — tiny hand-drawn line-art thumbnails.
// ---------------------------------------------------------------------------

// One art source, two renderers: JSX for the landing cards, and a standalone
// SVG string for the meditation space (WishSpace). The space blows the
// 110-unit viewBox up ~12×, so strokes are rescaled there — card-weight lines
// would render as fat marker at full screen.
type ArtEl = {
  d?: string;
  cx?: number; cy?: number; r?: number;
  stroke: string; w: number;
  dash?: string; fill?: string; op?: number;
  // drift/float: ambient loops. write: the line writes itself, pauses,
  // restarts (needs dash set to its own length, e.g. '18 18').
  anim?: 'drift' | 'float' | 'write';
  // Pose-frame animation (hand-drawn flip-book): elements tagged with the
  // same frame index show together; frames cycle A→B→C→B (wfRun keyframes).
  // Frames 1+ carry op:0 so reduced-motion / stills collapse to frame 0 only.
  frame?: 0 | 1 | 2;
};

type DemoWish = { title: string; titleZh: string; desc: string; descZh: string; els: ArtEl[] };

const SPACE_STROKE_SCALE = 0.32;

function artAnim(el: ArtEl): string | undefined {
  if (el.frame !== undefined) return `wfRun${el.frame} 1.2s linear infinite`;
  if (el.anim === 'drift') return 'wfRiverFlow 9s linear infinite';
  if (el.anim === 'float') return 'wfArtFloat 6s ease-in-out infinite';
  if (el.anim === 'write') return 'wfWrite 4.5s ease-in-out infinite';
  return undefined;
}

function renderArtJSX(els: ArtEl[]) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {els.map((el, i) => {
        const anim = artAnim(el);
        const style = anim ? { animation: anim } : undefined;
        return el.d ? (
          <path key={i} d={el.d} stroke={el.stroke} strokeWidth={el.w} strokeDasharray={el.dash}
            fill={el.fill || 'none'} opacity={el.op} style={style} />
        ) : (
          <circle key={i} cx={el.cx} cy={el.cy} r={el.r}
            stroke={el.fill ? 'none' : el.stroke} strokeWidth={el.fill ? undefined : el.w}
            fill={el.fill || 'none'} opacity={el.op} style={style} />
        );
      })}
    </g>
  );
}

function buildSpaceSvg(els: ArtEl[]): string {
  const parts = els
    .map(el => {
      const anim = artAnim(el);
      const style = anim ? ` style="animation: ${anim}"` : '';
      const op = el.op ? ` opacity="${el.op}"` : '';
      if (el.d) {
        const dash = el.dash ? ` stroke-dasharray="${el.dash}"` : '';
        return `<path d="${el.d}" stroke="${el.stroke}" stroke-width="${(el.w * SPACE_STROKE_SCALE).toFixed(2)}"${dash} fill="${el.fill || 'none'}"${op}${style}/>`;
      }
      const strokeAttrs = el.fill ? 'stroke="none"' : `stroke="${el.stroke}" stroke-width="${(el.w * SPACE_STROKE_SCALE).toFixed(2)}"`;
      return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" ${strokeAttrs} fill="${el.fill || 'none'}"${op}${style}/>`;
    })
    .join('\n    ');
  return `<svg viewBox="0 0 110 58" xmlns="http://www.w3.org/2000/svg">
  <style>@keyframes wfRiverFlow { to { stroke-dashoffset: -68; } } @keyframes wfArtFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } } @keyframes wfRun0 { 0%, 24.9% { opacity: 1; } 25%, 100% { opacity: 0; } } @keyframes wfRun1 { 0%, 24.9% { opacity: 0; } 25%, 49.9% { opacity: 1; } 50%, 74.9% { opacity: 0; } 75%, 100% { opacity: 1; } } @keyframes wfRun2 { 0%, 49.9% { opacity: 0; } 50%, 74.9% { opacity: 1; } 75%, 100% { opacity: 0; } } @keyframes wfWrite { 0% { stroke-dashoffset: 18; } 55%, 99.9% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 18; } }</style>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${parts}
  </g>
</svg>`;
}

const DEMO_WISHES: DemoWish[] = [
  {
    title: 'A bakery by the sea',
    titleZh: '海边的小面包店',
    desc: 'Warm bread, morning waves',
    descZh: '暖面包，晨浪',
    els: [
      // the bakery: pitched roof, display window with a loaf, door,
      // hanging round sign, chimney with drifting warmth
      { d: 'M 19 24 L 37 12 L 55 24', stroke: INK, w: 2.2 },
      { d: 'M 22 24 L 22 46 M 52 24 L 52 46', stroke: INK, w: 2 },
      { d: 'M 28 46 L 28 33 L 40 33 L 40 46 M 28 40 L 40 40', stroke: WISH, w: 1.5 },
      { d: 'M 31 38 Q 34 34 37 38', stroke: WISH, w: 1.6 },
      { d: 'M 44 46 L 44 34 L 49 34 L 49 46', stroke: INK, w: 1.6 },
      { d: 'M 56 24 L 58 26', stroke: WISH, w: 1.3 },
      { cx: 58, cy: 29, r: 3.2, stroke: WISH, w: 1.5 },
      { d: 'M 29 17 L 29 12 L 32 12 L 32 15', stroke: INK, w: 1.5 },
      { d: 'M 30 10 Q 28 6 31 3', stroke: SOFT, w: 1.3, anim: 'float' },
      // the sea: shore ground, two drifting wave lines, gulls
      { d: 'M 14 46 L 56 46', stroke: INK, w: 2 },
      { d: 'M 58 44 Q 66 41 74 44 Q 82 47 92 44', stroke: SOFT, w: 1.4, dash: '6 5', anim: 'drift' },
      { d: 'M 60 49 Q 70 46 80 49 Q 88 52 96 49', stroke: WISH, w: 1.3, dash: '7 6', anim: 'drift', op: 0.7 },
      { d: 'M 80 15 q 4 -4 8 0 M 90 19 q 3 -3 6 0', stroke: SOFT, w: 1.2 },
    ],
  },
  {
    title: 'Cruise with mom & dad',
    titleZh: '和爸妈坐一次邮轮',
    desc: 'Sunset talks on deck',
    descZh: '甲板上的日落长谈',
    els: [
      { d: 'M 22 40 L 78 40 Q 86 40 90 32 L 30 32 Q 24 36 22 40 Z', stroke: WISH, w: 1.8 },
      { d: 'M 40 32 L 40 24 L 66 24 L 70 32', stroke: WISH, w: 1.6 },
      { cx: 50, cy: 19, r: 2.4, stroke: INK, w: 1.8 },
      { cx: 58, cy: 18, r: 2.4, stroke: INK, w: 1.8 },
      { d: 'M 16 46 Q 34 43 52 46 Q 70 49 92 46', stroke: SOFT, w: 1.4, dash: '8 6', anim: 'drift' },
    ],
  },
  {
    title: 'Run a marathon',
    titleZh: '跑一次马拉松',
    desc: 'Feel truly strong',
    descZh: '感受真正的力量',
    els: [
      // hand-drawn flip-book run cycle, three poses cycling A→B→C→B.
      // Frame 0 · contact: front foot planted, back heel kicked high
      { cx: 48, cy: 13, r: 4.5, stroke: INK, w: 2.2, frame: 0 },
      { d: 'M 47 18 Q 45 25 43 31', stroke: INK, w: 2.2, frame: 0 },
      { d: 'M 46 21 Q 53 22 57 27', stroke: INK, w: 1.8, frame: 0 },
      { d: 'M 46 21 Q 40 25 37 30', stroke: INK, w: 1.8, frame: 0 },
      { d: 'M 43 31 Q 51 35 55 41 Q 57 44 57 48', stroke: INK, w: 2, frame: 0 },
      { d: 'M 43 31 Q 37 37 32 40 Q 29 42 28 44', stroke: INK, w: 2, frame: 0 },
      // Frame 1 · pass: knees under the body, a touch higher (the bob)
      { cx: 47, cy: 11, r: 4.5, stroke: INK, w: 2.2, frame: 1, op: 0 },
      { d: 'M 46 16 Q 45 23 44 29', stroke: INK, w: 2.2, frame: 1, op: 0 },
      { d: 'M 45 19 Q 50 21 52 25', stroke: INK, w: 1.8, frame: 1, op: 0 },
      { d: 'M 45 19 Q 41 22 39 25', stroke: INK, w: 1.8, frame: 1, op: 0 },
      { d: 'M 44 29 Q 48 33 48 38 Q 48 43 50 46', stroke: INK, w: 2, frame: 1, op: 0 },
      { d: 'M 44 29 Q 43 36 42 42 Q 42 46 43 49', stroke: INK, w: 2, frame: 1, op: 0 },
      // Frame 2 · opposite contact: legs and arms swapped
      { cx: 48, cy: 13, r: 4.5, stroke: INK, w: 2.2, frame: 2, op: 0 },
      { d: 'M 47 18 Q 45 25 43 31', stroke: INK, w: 2.2, frame: 2, op: 0 },
      { d: 'M 46 21 Q 52 25 55 30', stroke: INK, w: 1.8, frame: 2, op: 0 },
      { d: 'M 46 21 Q 40 21 36 25', stroke: INK, w: 1.8, frame: 2, op: 0 },
      { d: 'M 43 31 Q 50 34 54 40 Q 56 44 55 48', stroke: INK, w: 2, frame: 2, op: 0 },
      { d: 'M 43 31 Q 38 36 33 41 Q 30 44 30 47', stroke: INK, w: 2, frame: 2, op: 0 },
      // statics
      { d: 'M 18 50 L 88 50', stroke: WISH, w: 1.5 },
      { d: 'M 62 12 Q 72 9 80 13', stroke: SOFT, w: 1.3, dash: '5 5', anim: 'drift' },
    ],
  },
  {
    title: 'A sunflower yard',
    titleZh: '有向日葵的院子',
    desc: 'Nap with the cat in summer',
    descZh: '夏天和猫一起午睡',
    els: [
      { cx: 44, cy: 18, r: 6, stroke: INK, w: 2 },
      { d: 'M 44 9 L 44 5 M 53 18 L 57 18 M 44 27 L 44 31 M 35 18 L 31 18 M 50 12 L 53 9 M 50 24 L 53 27 M 38 24 L 35 27 M 38 12 L 35 9', stroke: WISH, w: 1.5, anim: 'float' },
      { d: 'M 44 27 Q 43 38 42 46', stroke: INK, w: 2 },
      { d: 'M 58 44 Q 62 40 66 44 Q 68 47 64 48 Q 58 49 58 44 Z', stroke: INK, w: 1.8 },
      { d: 'M 20 50 L 88 50', stroke: SOFT, w: 1.4 },
    ],
  },
  {
    title: 'Write a small book',
    titleZh: '写一本小书',
    desc: 'One honest page a day',
    descZh: '每天一页真心话',
    els: [
      { d: 'M 30 44 Q 42 38 54 44 Q 66 38 78 44 L 78 20 Q 66 14 54 20 Q 42 14 30 20 Z', stroke: INK, w: 2 },
      { d: 'M 54 20 L 54 44', stroke: INK, w: 1.6 },
      { d: 'M 36 26 Q 44 23 48 25 M 36 32 Q 44 29 48 31', stroke: WISH, w: 1.3 },
      // the pen, nib on the page — and the line it is writing, which slowly
      // writes itself, rests, and begins again
      { d: 'M 61 30 L 73 18 M 69 22 L 71 24', stroke: INK, w: 2 },
      { d: 'M 58 35 Q 62 33 66 35 Q 69 36.5 72 35', stroke: WISH, w: 1.4, dash: '18 18', anim: 'write' },
      { d: 'M 78 12 L 80 8 M 84 14 L 88 12', stroke: SOFT, w: 1.3, anim: 'float' },
    ],
  },
  {
    title: 'See the aurora',
    titleZh: '去看一次极光',
    desc: 'Green light over snow',
    descZh: '雪原上的绿光',
    els: [
      { d: 'M 24 30 Q 30 10 36 30 M 40 32 Q 46 8 52 32 M 56 30 Q 62 12 68 30', stroke: SOFT, w: 1.6, dash: '4 4', anim: 'drift' },
      { d: 'M 18 46 L 40 34 L 58 44 L 76 32 L 90 42', stroke: WISH, w: 1.8 },
      { cx: 80, cy: 14, r: 1.4, stroke: SOFT, w: 0, fill: SOFT },
      { cx: 30, cy: 8, r: 1.2, stroke: SOFT, w: 0, fill: SOFT },
    ],
  },
  {
    title: 'Learn the piano',
    titleZh: '学会钢琴',
    desc: 'One gentle song by heart',
    descZh: '背下一首温柔的曲子',
    els: [
      // upright piano: cabinet, keyboard ledge, white key seams, the 2+3
      // black-key pattern (the thing that makes a piano read as a piano),
      // legs and a pedal
      { d: 'M 24 22 L 74 22 L 74 42 L 24 42 Z', stroke: INK, w: 2.2 },
      { d: 'M 24 33 L 74 33', stroke: INK, w: 1.6 },
      { d: 'M 32 33 L 32 42 M 40 33 L 40 42 M 48 33 L 48 42 M 56 33 L 56 42 M 64 33 L 64 42', stroke: WISH, w: 1.2 },
      { d: 'M 29 33 L 29 37 M 35 33 L 35 37 M 44 33 L 44 37 M 52 33 L 52 37 M 60 33 L 60 37 M 67 33 L 67 37', stroke: INK, w: 2 },
      { d: 'M 26 42 L 26 48 M 72 42 L 72 48 M 46 48 L 53 48', stroke: INK, w: 1.7 },
      { d: 'M 80 18 Q 84 12 82 8 Q 86 10 88 14', stroke: SOFT, w: 1.4, anim: 'float' },
    ],
  },
  {
    title: 'A house with a porch',
    titleZh: '有门廊的房子',
    desc: 'Tea, rain, a slow evening',
    descZh: '茶、雨、慢慢的傍晚',
    els: [
      { d: 'M 28 46 L 28 26 L 48 14 L 68 26 L 68 46', stroke: INK, w: 2.2 },
      { d: 'M 22 46 L 74 46', stroke: INK, w: 1.8 },
      { d: 'M 40 46 L 40 34 L 50 34 L 50 46', stroke: WISH, w: 1.6 },
      { d: 'M 58 20 L 58 12 M 58 12 Q 57 8 60 6', stroke: SOFT, w: 1.4, anim: 'float' },
    ],
  },
  {
    title: 'Plant a tiny forest',
    titleZh: '种一小片森林',
    desc: 'Shade for someone later',
    descZh: '给后来的人一片树荫',
    els: [
      { d: 'M 34 46 Q 33 34 32 28 M 32 28 Q 24 30 26 22 Q 33 20 34 26 Q 37 18 44 22 Q 44 30 34 28', stroke: INK, w: 1.9 },
      { d: 'M 58 46 Q 58 38 58 34 M 58 34 Q 50 34 52 27 Q 58 26 58 31 Q 60 24 67 27 Q 67 34 58 34', stroke: WISH, w: 1.7 },
      { d: 'M 76 46 Q 76 42 76 40 M 76 40 Q 72 40 73 36 Q 76 35 76 38 Q 78 34 81 36 Q 81 40 76 40', stroke: SOFT, w: 1.5 },
      { d: 'M 20 50 L 90 50', stroke: SOFT, w: 1.3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Hand-drawn scenery layers (inline SVG, viewBox sliced to fill the viewport)
// ---------------------------------------------------------------------------

function SkyLayer() {
  return (
    <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* low sun, lifted clear of the ridge band below (≥50px gap) */}
        <circle cx="1010" cy="385" r="58" stroke={SOFT} strokeWidth="1.6" strokeDasharray="6 8" opacity="0.8" />
        <path d="M 940 327 L 930 315 M 1010 303 L 1010 289 M 1080 327 L 1092 315" stroke={SOFT} strokeWidth="1.4" opacity="0.6" />
        {/* far ridges — full-width horizon lines; where they pass the gate
            they read as the world seen behind the doorway */}
        <path d="M -20 520 Q 180 452 380 508 T 760 500 T 1180 505 T 1470 490" stroke={SOFT} strokeWidth="1.6" opacity="0.65" />
        <path d="M -20 560 Q 240 500 480 548 T 950 545 T 1470 535" stroke={SOFT} strokeWidth="1.4" opacity="0.4" />
        {/* birds */}
        <path d="M 350 260 q 8 -8 16 0 q 8 -8 16 0 M 420 230 q 6 -6 12 0 q 6 -6 12 0" stroke={SOFT} strokeWidth="1.5" opacity="0.7" />
        {/* faint stars */}
        <circle cx="220" cy="150" r="2" fill={SOFT} opacity="0.5" />
        <circle cx="820" cy="120" r="1.6" fill={SOFT} opacity="0.4" />
        <circle cx="1240" cy="190" r="1.8" fill={SOFT} opacity="0.45" />
      </g>
    </svg>
  );
}

function RiverLayer() {
  // 河流：少而有起伏的断笔触虚线，缓慢向左流动。三条主线，波峰错位。
  const lines = [
    { d: 'M -40 596 Q 160 566 360 598 Q 560 628 760 592 Q 960 560 1160 596 Q 1320 622 1480 590', w: 2.1, dash: '22 15', color: WISH, op: 0.85, dur: 10 },
    { d: 'M -40 668 Q 220 636 460 670 Q 700 702 940 664 Q 1180 630 1480 668', w: 1.7, dash: '16 13', color: SOFT, op: 0.7, dur: 14 },
    { d: 'M -40 742 Q 280 712 580 744 Q 880 774 1180 738 Q 1330 722 1480 742', w: 1.5, dash: '26 18', color: SOFT, op: 0.45, dur: 18 },
  ];
  return (
    <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <g fill="none" strokeLinecap="round">
        {lines.map((l, i) => (
          <path key={i} d={l.d} stroke={l.color} strokeWidth={l.w} strokeDasharray={l.dash} opacity={l.op}
            style={{ animation: `wfRiverFlow ${l.dur}s linear infinite` }} />
        ))}
        {/* foam ticks */}
        <path d="M 330 618 L 354 618 M 720 688 L 738 688 M 1050 616 L 1074 616" stroke={SOFT} strokeWidth="1.3" opacity="0.45" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function GateLayer({ isMobile }: { isMobile: boolean }) {
  // 手绘拱门 + 门内的小船：滚动时镜头从门中穿过。桌面端让位给左侧文案。
  return (
    <svg viewBox="0 0 600 520" style={{ position: 'absolute', left: isMobile ? '50%' : '68%', top: isMobile ? '38%' : '50%', width: isMobile ? 'min(46vh, 82vw)' : 'min(60vh, 42vw)', height: 'auto', transform: 'translate(-50%, -54%)' }}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* outer arch, slightly wobbly */}
        <path d="M 152 470 L 150 226 Q 151 96 300 92 Q 449 96 450 224 L 448 470" stroke={INK} strokeWidth="3.4" />
        <path d="M 174 470 L 172 234 Q 174 116 300 112 Q 426 116 428 232 L 426 470" stroke={SOFT} strokeWidth="1.6" opacity="0.7" />
        {/* stone ticks along the arch */}
        <path d="M 156 300 L 172 298 M 158 240 L 174 242 M 176 160 L 190 168 M 226 112 L 232 126 M 300 94 L 300 110 M 372 112 L 366 126 M 424 158 L 410 166 M 444 238 L 428 240 M 446 300 L 430 298" stroke={INK} strokeWidth="1.6" opacity="0.55" />
        {/* guiding star above the arch */}
        <path d="M 300 44 L 305 58 L 319 60 L 308 69 L 312 83 L 300 74 L 288 83 L 292 69 L 281 60 L 295 58 Z" stroke={WISH} strokeWidth="1.6" opacity="0.85" />
        {/* the little boat inside, bobbing on one short broken wave (kept tight
            under the hull so it never tangles with the page river behind) */}
        <g style={{ animation: 'wfFloatBoat 4.5s ease-in-out infinite', transformOrigin: '300px 392px' }}>
          <path d="M 258 380 Q 300 396 342 380 L 330 402 Q 300 412 270 402 Z" stroke={INK} strokeWidth="2.6" />
          <path d="M 300 376 L 300 306 M 300 310 Q 336 322 302 352" stroke={INK} strokeWidth="2.2" />
        </g>
        <path d="M 252 406 Q 278 400 300 406 T 350 404" stroke={WISH} strokeWidth="1.8" strokeDasharray="12 9" style={{ animation: 'wfRiverFlow 8s linear infinite' }} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------

export default function HomePage() {
  const { language } = useLanguage();
  const zh = language === 'zh';
  const containerRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const riverRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const mistLRef = useRef<HTMLDivElement>(null);
  const mistRRef = useRef<HTMLDivElement>(null);
  const scene1Ref = useRef<HTMLDivElement>(null);
  const scene2Ref = useRef<HTMLDivElement>(null);
  const arcWrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const entranceDoneRef = useRef(false);

  const [uiVisible, setUiVisible] = useState(false);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Tapping a demo card zooms into the full meditation space — the homepage
  // demos the real product moment with a synthetic LocalWish.
  const [spaceTarget, setSpaceTarget] = useState<{ wish: LocalWish; rect: DOMRect } | null>(null);

  const openSpace = (w: DemoWish, rect: DOMRect) => {
    const now = new Date().toISOString();
    setSpaceTarget({
      rect,
      wish: {
        id: `demo-${w.title}`,
        title: zh ? w.titleZh : w.title,
        description: zh ? w.descZh : w.desc,
        domain: null, stage: null, will_source: null, end_scene: null,
        time_scope: null, target_time: null, svg_pattern: null,
        svg_data: buildSpaceSvg(w.els),
        keywords: [], mood: null, line_seed: null, user_image: null,
        pinned: false, last_connected_at: null, last_level: null,
        created_at: now, updated_at: now,
      },
    });
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const rq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsMobile(mq.matches);
    setReduced(rq.matches);
    const onMq = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onRq = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onMq);
    rq.addEventListener('change', onRq);

    const t1 = setTimeout(() => setCurtainsOpen(true), 100);
    const t2 = setTimeout(() => setUiVisible(true), 600);
    const t3 = setTimeout(() => { entranceDoneRef.current = true; }, 2200);
    return () => {
      mq.removeEventListener('change', onMq);
      rq.removeEventListener('change', onRq);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const mouse = { x: 0, y: 0 };
    const sm = { x: 0, y: 0 };
    const allowMouse = !isMobile;

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    };
    if (allowMouse) window.addEventListener('mousemove', onMove);

    const spacing = isMobile ? 14 : 14;
    const radius = isMobile ? 700 : 1100;
    const cardW = isMobile ? 215 : 370;
    const bottomLift = isMobile ? 190 : 290;
    const n = DEMO_WISHES.length;
    const center = Math.floor(n / 2);
    const sweep = (n - 1) * 10;

    const loop = () => {
      sm.x = lerp(sm.x, allowMouse ? mouse.x : 0, 0.07);
      sm.y = lerp(sm.y, allowMouse ? mouse.y : 0, 0.07);

      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const run = rect.height - window.innerHeight;
        const p = run > 0 ? clamp(-rect.top / run, 0, 1) : 0;
        const ep = easeInOut(p);

        // The zoomed landscape STAYS as scene 2's backdrop (user call,
        // 2026-07-17): sun and river keep breathing behind the cards — only
        // the gate/boat must be fully gone before the cards rise, because
        // half-faded giant arch strokes over the sheets read as clutter.
        if (skyRef.current) {
          skyRef.current.style.transform =
            `translate(${-sm.x * MAG.sky}px, ${-sm.y * MAG.sky}px) scale(${lerp(1, 1.15, ep)})`;
        }
        if (riverRef.current) {
          riverRef.current.style.transform =
            `translate(${-sm.x * MAG.river}px, ${-sm.y * MAG.river * 0.4}px) scale(${lerp(1, 1.2, ep)})`;
          // Full through scene 1, then settle back to a soft 35% under-current
          // that keeps flowing beneath the pinned cards.
          riverRef.current.style.opacity = String(1 - 0.65 * clamp((p - 0.3) / 0.3, 0, 1));
        }
        if (gateRef.current) {
          // Visible while we sail through it, fully gone the moment scene 2
          // rises (p=0.62) — never a half-faded gate over the cards.
          const gateOp = p < 0.5 ? 1 : clamp(1 - (p - 0.5) / 0.12, 0, 1);
          gateRef.current.style.opacity = String(gateOp);
          gateRef.current.style.transform =
            `translate(${-sm.x * MAG.gate}px, ${-sm.y * MAG.gate}px) scale(${lerp(1, 4, ep)})`;
        }
        if (entranceDoneRef.current) {
          const push = lerp(0, 90, ep);
          if (mistLRef.current) {
            mistLRef.current.style.transition = 'none';
            mistLRef.current.style.transform =
              `translateX(calc(-70% - ${push}% + ${-sm.x * MAG.mist}px)) translateY(${-sm.y * MAG.mist * 0.3}px)`;
          }
          if (mistRRef.current) {
            mistRRef.current.style.transition = 'none';
            mistRRef.current.style.transform =
              `translateX(calc(70% + ${push}% + ${-sm.x * MAG.mist}px)) translateY(${-sm.y * MAG.mist * 0.3}px)`;
          }
        }
        if (scene1Ref.current) {
          const op = clamp(1 - p / 0.22, 0, 1);
          scene1Ref.current.style.opacity = String(op);
          scene1Ref.current.style.pointerEvents = op < 0.2 ? 'none' : 'auto';
        }
        // Tight ramp: the cards snap to full presence quickly — lingering
        // half-transparent sheets read as ghosts, not paper.
        const s2op = clamp((p - 0.6) / 0.08, 0, 1);
        if (scene2Ref.current) {
          // Never let this full-viewport text layer intercept the pointer —
          // it sits ABOVE the cards and would swallow their clicks.
          scene2Ref.current.style.opacity = String(s2op);
        }
        if (arcWrapRef.current) {
          arcWrapRef.current.style.opacity = String(s2op);
          // Invisible cards must not swallow clicks in scene 1.
          arcWrapRef.current.style.visibility = s2op < 0.05 ? 'hidden' : 'visible';
        }
        // arc cards
        const rot = lerp(0, sweep, clamp((p - 0.66) / 0.34, 0, 1));
        for (let i = 0; i < n; i++) {
          const card = cardRefs.current[i];
          if (!card) continue;
          const deg = (i - center) * spacing - rot + center * spacing;
          const rad = (deg * Math.PI) / 180;
          const x = Math.sin(rad) * radius;
          const y = radius - Math.cos(rad) * radius;
          card.style.bottom = `${-y + bottomLift}px`;
          card.style.left = `calc(50% + ${x - cardW / 2}px)`;
          card.style.transform = `rotate(${deg}deg)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (allowMouse) window.removeEventListener('mousemove', onMove);
    };
  }, [reduced, isMobile]);

  // "See how it works": auto-drive the whole scroll cinematic (~9s, eased).
  // Any user wheel/touch takes the wheel back immediately.
  const tourRef = useRef(false);
  const playTour = () => {
    const el = containerRef.current;
    if (!el || tourRef.current) return;
    const startY = window.scrollY;
    const targetY = el.offsetTop + el.offsetHeight - window.innerHeight;
    const dur = 6000;
    const t0 = performance.now();
    tourRef.current = true;
    const cancel = () => {
      tourRef.current = false;
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    const step = (now: number) => {
      if (!tourRef.current) return;
      const t = clamp((now - t0) / dur, 0, 1);
      window.scrollTo(0, startY + (targetY - startY) * easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else cancel();
    };
    requestAnimationFrame(step);
  };

  const serif = 'var(--font-serif), Georgia, serif';
  const fade = (delay: string) => ({
    opacity: uiVisible ? 1 : 0,
    transform: uiVisible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.9s ease ${delay}, transform 0.9s ease ${delay}`,
  });

  const cardW = isMobile ? 215 : 370;
  const cardH = isMobile ? 255 : 410;

  const renderCard = (w: DemoWish, i: number, forArc: boolean) => (
    <PaperCard
      key={w.title}
      cardRef={forArc ? (el) => { cardRefs.current[i] = el; } : undefined}
      manageTransform={false}
      clickable
      onClick={(e) => openSpace(w, e.currentTarget.getBoundingClientRect())}
      role="button"
      aria-label={zh ? `走进「${w.titleZh}」` : `Step into "${w.title}"`}
      clipRot={36 + ((i % 3) - 1) * 4}
      style={{
        position: forArc ? 'absolute' : 'relative',
        width: cardW,
        height: cardH,
        transformOrigin: forArc ? `${cardW / 2}px ${isMobile ? 700 : 1100}px` : undefined,
        pointerEvents: 'auto',
      }}
    >
      <svg viewBox="0 0 110 58" style={{ width: '100%', height: isMobile ? 112 : 195 }}>{renderArtJSX(w.els)}</svg>
      <p style={{ fontFamily: serif, fontSize: isMobile ? 18 : 25, color: 'var(--ink)', margin: '12px 0 5px', lineHeight: 1.25 }}>{zh ? w.titleZh : w.title}</p>
      <p style={{ fontSize: isMobile ? 12.5 : 15.5, color: 'var(--text)', opacity: 0.78, margin: 0, lineHeight: 1.5 }}>{zh ? w.descZh : w.desc}</p>
    </PaperCard>
  );

  // ------- reduced-motion: quiet static two-section page -------
  if (reduced) {
    return (
      <div style={{ padding: '10vh 24px' }}>
        <section style={{ maxWidth: 720, margin: '0 auto 12vh', textAlign: 'center' }}>
          <h1 style={{ fontFamily: serif, fontSize: 'clamp(40px, 6vw, 68px)', color: 'var(--ink)', lineHeight: 1.1 }}>{zh ? '让愿望，慢慢成形。' : 'Let wishes slowly take shape.'}</h1>
          <p style={{ color: 'var(--text)', maxWidth: 460, margin: '20px auto 32px', lineHeight: 1.8 }}>
            {zh ? '一个温柔的愿望导航系统。把愿望留在这里——它会陪你等过每一个季节。' : 'A gentle wish navigation system. Leave your wish here — it will wait for you through every season.'}
          </p>
          <Link href="/try" style={{ background: 'var(--wish)', color: '#fff', borderRadius: 999, padding: '12px 26px', textDecoration: 'none' }}>{zh ? '生成我的第一张愿望图' : 'Generate my first wish map'}</Link>
        </section>
        <section style={{ maxWidth: 980, margin: '0 auto' }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--ink)', textAlign: 'center', marginBottom: 32 }}>{zh ? '你的愿望住在这里。' : 'Your wishes live here.'}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
            {DEMO_WISHES.map((w, i) => renderCard(w, i, false))}
          </div>
        </section>
        {spaceTarget && (
          <WishSpace
            wish={spaceTarget.wish}
            originRect={spaceTarget.rect}
            onClose={() => setSpaceTarget(null)}
            instantAlive
            manifestHref="/try"
          />
        )}
      </div>
    );
  }

  // Entrance panels are now plain paper — a blank sheet parting to reveal the
  // drawing — instead of purple mist, which read as grime on the clean page.
  const mistBase: React.CSSProperties = {
    position: 'absolute', top: '-12%', bottom: '-12%', width: '56%',
    pointerEvents: 'none',
    transition: 'transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div ref={containerRef} style={{ height: isMobile ? '300vh' : '400vh', position: 'relative' }}>
      <style>{`
        @keyframes wfRiverFlow { to { stroke-dashoffset: -68; } }
        @keyframes wfArtFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }
        @keyframes wfRun0 { 0%, 24.9% { opacity: 1; } 25%, 100% { opacity: 0; } }
        @keyframes wfRun1 { 0%, 24.9% { opacity: 0; } 25%, 49.9% { opacity: 1; } 50%, 74.9% { opacity: 0; } 75%, 100% { opacity: 1; } }
        @keyframes wfRun2 { 0%, 49.9% { opacity: 0; } 50%, 74.9% { opacity: 1; } 75%, 100% { opacity: 0; } }
        @keyframes wfWrite { 0% { stroke-dashoffset: 18; } 55%, 99.9% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 18; } }
        @keyframes wfBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes wfFloatBoat {
          0%, 100% { transform: translateY(0) rotate(-1.3deg); }
          50% { transform: translateY(-6px) rotate(1.5deg); }
        }
        /* This page wants a cleaner sheet: dial the global purple ambience down. */
        .ambient { opacity: 0.35 !important; }
      `}</style>

      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: 'transparent' }}>

        {/* L1 · sky + far ridges */}
        <div ref={skyRef} style={{ position: 'absolute', inset: 0, transformOrigin: '50% 55%', willChange: 'transform' }}>
          <SkyLayer />
        </div>

        {/* L2 · river, broken-line strokes */}
        <div ref={riverRef} style={{ position: 'absolute', inset: 0, transformOrigin: '50% 78%', willChange: 'transform', zIndex: 8 }}>
          <RiverLayer />
        </div>

        {/* L3 · the gate we sail through */}
        <div ref={gateRef} style={{ position: 'absolute', inset: 0, transformOrigin: isMobile ? '50% 38%' : '68% 46%', willChange: 'transform', zIndex: 15 }}>
          <GateLayer isMobile={isMobile} />
        </div>

        {/* bottom paper mist */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '30vh', zIndex: 17, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(250,249,247,0.95) 0%, rgba(250,249,247,0.6) 45%, transparent 100%)',
        }} />

        {/* paper-mist curtains */}
        <div ref={mistLRef} style={{
          ...mistBase, left: '-8%',
          background: 'linear-gradient(90deg, #FAF9F7 0%, #FAF9F7 72%, rgba(250,249,247,0) 100%)',
          transform: curtainsOpen ? 'translateX(-70%)' : 'translateX(0)',
          zIndex: 16,
        }} />
        <div ref={mistRRef} style={{
          ...mistBase, right: '-8%',
          background: 'linear-gradient(270deg, #FAF9F7 0%, #FAF9F7 72%, rgba(250,249,247,0) 100%)',
          transform: curtainsOpen ? 'translateX(70%)' : 'translateX(0)',
          zIndex: 16,
        }} />

        {/* Scene 1 UI — desktop: copy sits left-of-center, above the mist layer */}
        <div ref={scene1Ref} style={{
          position: 'absolute', inset: 0, zIndex: 32,
          display: 'flex', flexDirection: 'column',
          alignItems: isMobile ? 'center' : 'flex-start',
          justifyContent: isMobile ? 'flex-end' : 'center',
          textAlign: isMobile ? 'center' : 'left',
          padding: isMobile ? '0 24px 18vh' : '0 24px 0 clamp(60px, 15vw, 300px)',
        }}>
          {/* 手机端文案区托底: 拱门插画居中, 而文案块贴底占了大半屏, 英文字更长直接压在画上。
              铺一层从透明到纸色的渐变, 插画仍在下面若隐若现, 字始终落在纸上。 */}
          {isMobile && (
            <div aria-hidden="true" style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%', zIndex: -1, pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(250,249,247,0) 0%, rgba(250,249,247,0.72) 22%, rgba(250,249,247,0.94) 46%, rgba(250,249,247,0.98) 100%)',
            }} />
          )}
          <p style={{ ...fade('0.2s'), fontSize: 12, letterSpacing: zh ? '0.3em' : '0.18em', textTransform: 'uppercase', color: 'var(--wish)', fontWeight: 600, marginBottom: 18 }}>
            {zh ? '愿航 · 一生级愿望导航' : 'Wishflow · Life-long Wish Navigation'}
          </p>
          <h1 style={{ ...fade('0.3s'), fontFamily: serif, fontSize: isMobile ? 'clamp(34px, 9vw, 44px)' : 'clamp(38px, 4.6vw, 62px)', color: 'var(--ink)', lineHeight: zh ? 1.25 : 1.08, margin: 0, maxWidth: isMobile ? 420 : 520 }}>
            {zh ? '让愿望，慢慢成形。' : 'Let wishes slowly take shape.'}
          </h1>
          <p style={{ ...fade('0.45s'), color: 'var(--text)', maxWidth: isMobile ? 400 : 400, lineHeight: 1.8, margin: '22px 0 34px' }}>
            {zh ? '从此刻的心愿到一生的蓝图——梦的每个阶段，都被温柔保管。' : 'From your present wishes to your life-long blueprints — every stage of your dreams is gently preserved.'}
          </p>
          {/* 两颗 CTA 等宽等高: flex:1 均分同一条容器, 高度锁 50 ——
              原本一个 padding 13/28、一个 13/24, 文案长短又不同, 手机上一长一短很难看 */}
          <div style={{ ...fade('0.55s'), display: 'flex', gap: 12,
            width: isMobile ? '100%' : 'min(100%, 480px)', maxWidth: 480 }}>
            <Link href="/try" style={{ ...ctaBase, background: 'var(--wish)', color: '#fff',
              boxShadow: 'var(--shadow-lift, 0 10px 30px rgba(107,92,142,0.18))' }}>
              {zh ? '生成我的第一张愿望图' : 'Generate my first wish map'}
            </Link>
            <button onClick={playTour} style={{ ...ctaBase, background: 'rgba(255,255,255,0.85)',
              color: 'var(--ink)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              {zh ? '看看它如何运作' : 'See how it works'}
            </button>
          </div>
          {!isMobile && (
            <div style={{ ...fade('0.9s'), position: 'absolute', bottom: 34, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, letterSpacing: zh ? '0.3em' : '0.22em', textTransform: 'uppercase', color: 'var(--text)', opacity: 0.7 }}>{zh ? '顺流而下' : 'Drift down'}</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid rgba(107,92,142,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'wfBob 1.8s ease-in-out infinite' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M 3 5 L 7 9 L 11 5" stroke={WISH} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          )}
        </div>

        {/* Scene 2 UI */}
        <div ref={scene2Ref} style={{
          position: 'absolute', inset: 0, zIndex: 46, opacity: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', paddingTop: isMobile ? '12vh' : '14vh',
        }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(30px, 5vw, 56px)', color: 'var(--ink)', lineHeight: zh ? 1.3 : 1.1, margin: 0, padding: '0 24px' }}>
            {zh ? '你的愿望住在这里。' : 'Your wishes live here.'}
          </h2>
          <p style={{ color: 'var(--text)', maxWidth: 440, lineHeight: 1.7, margin: '16px 24px 0' }}>
            {zh ? '像一张张小纸片被轻轻别起——没有期限，没有打卡。继续滚动，一张张翻看。' : 'Pinned like small sheets of paper — no deadlines, no streaks. Keep scrolling to leaf through them.'}
          </p>
          {/* container is pointer-transparent (cards live below it); the CTA
              itself opts back in */}
          <Link
            href="/try"
            style={{ pointerEvents: 'auto', marginTop: 26, background: 'var(--wish)', color: '#fff', borderRadius: 999, padding: '13px 30px', textDecoration: 'none', boxShadow: 'var(--shadow-lift, 0 10px 30px rgba(107,92,142,0.18))' }}
          >
            {zh ? '创建我的愿望' : 'Create my wish'}
          </Link>
        </div>

        {/* arc card slider — fades in with scene 2 */}
        <div ref={arcWrapRef} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: isMobile ? 430 : 645, zIndex: 45, pointerEvents: 'none', opacity: 0, visibility: 'hidden' }}>
          {DEMO_WISHES.map((w, i) => renderCard(w, i, true))}
        </div>

      </div>

      {/* Meditation space demo — zooms out of whichever card was tapped.
          Demo mode: straight into the living scene, with a manifest CTA. */}
      {spaceTarget && (
        <WishSpace
          wish={spaceTarget.wish}
          originRect={spaceTarget.rect}
          onClose={() => setSpaceTarget(null)}
          instantAlive
          manifestHref="/try"
        />
      )}
    </div>
  );
}
