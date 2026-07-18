/**
 * RiverMap Component / 河流地图组件
 * A life timeline drawn in metro-map grammar (2026-07-10 重画):
 * ONE stable ink river line winding left to right; wishes are stops ON the
 * line — hollow circles in the same magnitude vocabulary as the StarMap
 * (hollow → dot-in-ring → double ring), labels alternate above/below with
 * thin 45° leader lines. No gradient water, no haze, no glow.
 * 参考语法:Duolingo path / transit maps / Fisk meander maps。
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { LocalWish } from '@/lib/localStore';
import { useLanguage } from '@/components/LanguageProvider';
import { useSettings } from '@/hooks/useSettings';
import MapTooltip from './MapTooltip';
import { makeRiverline, makeDust, truncateTitle, resolveCollisions } from './artUtils';
import styles from './WishMap.module.css';

type RiverMapProps = {
  wishes: LocalWish[];
  selectedWishId?: string | null;
  onWishSelect?: (wish: LocalWish) => void;
  onWishClick?: (wish: LocalWish) => void;
};

const WIDTH = 960;
const CANVAS_HEIGHT = 620;

// The river is a WIDE waterway, not a line: boats drift in four staggered
// lanes between two banks, each nudged by its own seed.
const LANES = [-72, -28, 20, 66];

// Stage X positions (center of each column)
const STAGE_POSITIONS: Record<string, number> = {
  '13-18': 96,
  '18-25': 288,
  '25-35': 480,
  '35-50': 672,
  '50+': 864,
  '一生': 480,
  'lifetime': 480,
  '现在-未来十年': 480,
};

const STAGE_COLUMNS = ['13-18', '18-25', '25-35', '35-50', '50+'];

// Normalize stage to one of the 5 main columns for X positioning
function normalizeStage(stage: string | null): string {
  if (!stage) return '25-35';
  if (stage === '一生' || stage === 'lifetime' || stage === '现在-未来十年') {
    return '25-35';
  }
  if (stage.includes('18') && stage.includes('25')) return '18-25';
  if (stage.includes('13') && stage.includes('18')) return '13-18';
  if (stage.includes('25') && stage.includes('35')) return '25-35';
  if (stage.includes('35') && stage.includes('50')) return '35-50';
  if (stage.includes('50')) return '50+';
  return '25-35';
}

// Max horizontal spacing between boats sharing one life stage
const STOP_SPACING = 120;

// Each wish is a little paper boat set onto the river — like river lanterns
// released downstream, but boats. Connection depth = presence on the water:
// minimum drifts pale and small, normal sails in ink, deep carries a warm
// lantern glow on the water around it.
function BoatGlyph({ level }: { level: string | null }) {
  const deep = level === 'deep';
  const mid = level === 'normal';
  const stroke = deep ? '#4A3D70' : mid ? '#5B4B84' : '#8B7BB0';
  const sw = deep ? 1.35 : mid ? 1.2 : 1.05;
  // Boats are small cards, not dots — the river carries them, not pins them
  const s = (deep ? 1.16 : mid ? 1 : 0.88) * 2.2;
  return (
    <g transform={`scale(${s})`}>
      {deep && <ellipse cx="0" cy="3" rx="22" ry="10" fill="url(#rm-lantern)" />}
      {/* hull */}
      <path
        d="M -15 0 L -9 8 Q 0 11.5 9 8 L 15 0 Z"
        fill="#FFFFFF" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
      />
      {/* the folded paper peak */}
      <path
        d="M -15 0 L -3.5 0 L 0 -9 L 3.5 0 L 15 0"
        fill="#FFFFFF" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
      />
      {(mid || deep) && <circle cx="0" cy="-3.4" r="1.5" fill={stroke} />}
      {/* broken reflection on the water */}
      <path
        d="M -10 14 L -4 14 M 3 15.5 L 11 15.5"
        stroke={stroke} strokeWidth="1.2" opacity="0.35" strokeLinecap="round"
      />
    </g>
  );
}

export default function RiverMap({ wishes, selectedWishId, onWishSelect, onWishClick }: RiverMapProps) {
  const { language } = useLanguage();
  const { settings } = useSettings();
  const [tooltipWish, setTooltipWish] = useState<LocalWish | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  const wishesByColumn = useMemo(() => {
    const grouped: Record<string, LocalWish[]> = {};
    wishes.forEach(wish => {
      const column = normalizeStage(wish.stage);
      if (!grouped[column]) grouped[column] = [];
      grouped[column].push(wish);
    });
    return grouped;
  }, [wishes]);

  // The river itself — a wide winding waterway
  const river = useMemo(() => makeRiverline(CANVAS_HEIGHT, 34), []);

  // Sparse light specks along the water
  const dust = useMemo(
    () => makeDust(WIDTH, CANVAS_HEIGHT, 18, 11, { yAt: river.yAt, spread: 54 }),
    [river]
  );

  // Stops sit ON the line: wishes sharing a stage spread horizontally around
  // the column center (0, -1, +1, -2, +2 …), each pinned to the river's y.
  const wishPositions = useMemo(() => {
    const out = wishes.map(wish => {
      const column = normalizeStage(wish.stage);
      const columnWishes = wishesByColumn[column] || [];
      const indexInColumn = columnWishes.findIndex(w => w.id === wish.id);
      const baseX = STAGE_POSITIONS[column] || 480;

      // Spread the column's boats evenly around its center, capped so one
      // stage never drifts into its neighbour's water
      const n = columnWishes.length;
      const spacing = n > 1 ? Math.min(STOP_SPACING, 300 / (n - 1)) : 0;
      const cx = baseX + (indexInColumn - (n - 1) / 2) * spacing;
      // Labels alternate above/below; within one side they cycle through
      // three tiers, so same-tier neighbours sit ~6 boats apart — a crowded
      // stage can never overlap its names
      const side = indexInColumn % 2 === 0 ? -1 : 1;
      const tier = Math.floor(indexInColumn / 2) % 3;
      // Each boat rides its own slow swell, in its own lane of the waterway
      const seed = Array.from(wish.id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const lane = LANES[(indexInColumn + (seed % 2)) % LANES.length] + ((seed % 5) - 2) * 3;
      return {
        wish,
        side,
        tier,
        bobDur: 4.2 + (seed % 5) * 0.55,
        bobDelay: -((seed % 7) * 0.8),
        position: { cx, cy: river.yAt(cx) + lane },
      };
    });
    // Boats share the waterway, never a berth
    resolveCollisions(out.map(p => p.position), 80);
    return out;
  }, [wishes, wishesByColumn, river]);

  const handleMouseMove = useCallback((e: React.MouseEvent, wish: LocalWish) => {
    const rect = e.currentTarget.closest('svg')?.parentElement?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    setTooltipWish(wish);
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleNodeClick = useCallback((wish: LocalWish) => {
    onWishSelect?.(wish);
    onWishClick?.(wish);
  }, [onWishSelect, onWishClick]);

  const containerClass = settings.animationEnabled ? styles.mapWrap : `${styles.mapWrap} ${styles.noAnimation}`;

  return (
    <div className={containerClass} style={{ minHeight: 'auto' }}>
      <div className={styles.mapTop} style={{ paddingBottom: 8 }}>
        <b>{language === 'zh' ? '人生之河' : 'Life River'}</b>
        <div className={styles.legend}>
          <span><span className={`${styles.legendDot} ${styles.legendDotLow}`}></span>{language === 'zh' ? '最低' : 'Min'}</span>
          <span><span className={`${styles.legendDot} ${styles.legendDotMid}`}></span>{language === 'zh' ? '正常' : 'Normal'}</span>
          <span><span className={`${styles.legendDot} ${styles.legendDotDeep}`}></span>{language === 'zh' ? '深度' : 'Deep'}</span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${CANVAS_HEIGHT}`}
          className={styles.svgCanvas}
          style={{ height: CANVAS_HEIGHT }}
          role="img"
          aria-label={language === 'zh' ? '愿力地图（河流）' : 'Wish Map (River)'}
        >
          <defs>
            {/* Stage markers fade into the mist at both ends */}
            <linearGradient id="rm-mistfade" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(91, 75, 132, 0)" />
              <stop offset="30%" stopColor="rgba(91, 75, 132, 0.2)" />
              <stop offset="70%" stopColor="rgba(91, 75, 132, 0.2)" />
              <stop offset="100%" stopColor="rgba(91, 75, 132, 0)" />
            </linearGradient>
            {/* The lantern light a deeply-connected boat carries on the water */}
            <radialGradient id="rm-lantern">
              <stop offset="0%" stopColor="rgba(155, 143, 196, 0.4)" />
              <stop offset="70%" stopColor="rgba(155, 143, 196, 0.14)" />
              <stop offset="100%" stopColor="rgba(155, 143, 196, 0)" />
            </radialGradient>
          </defs>

          {/* Stage columns */}
          {STAGE_COLUMNS.slice(1).map((stage, i) => {
            const x = 192 * (i + 1);
            return (
              <line
                key={`sep-${stage}`}
                x1={x} y1={44} x2={x} y2={CANVAS_HEIGHT - 16}
                className={styles.stageMark}
              />
            );
          })}
          {STAGE_COLUMNS.map((stage) => (
            <text
              key={`stage-${stage}`}
              x={STAGE_POSITIONS[stage]}
              y={30}
              className={styles.stageText}
              textAnchor="middle"
            >
              {stage === '50+' ? '50+' : stage.replace('-', '–')}
            </text>
          ))}

          {/* The waterway: two broken-line banks holding a wide current,
              inner streams drifting between them — never a solid wall */}
          <path d={river.offsetPath(-110)} className={styles.riverBank} />
          <path d={river.offsetPath(110)} className={styles.riverBank} style={{ animationDelay: '-9s' }} />
          <path d={river.offsetPath(-48)} className={styles.riverStream} />
          <path d={river.offsetPath(46)} className={styles.riverStream} style={{ animationDelay: '-6s' }} />
          <path d={river.path} className={styles.riverLight} />

          {/* Light on the water */}
          <g aria-hidden="true">
            {dust.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={d.r}
                className={d.twinkle ? styles.dustTwinkle : styles.dust}
                style={
                  d.twinkle
                    ? ({
                        '--dust-base': d.opacity,
                        animationDuration: `${d.duration}s`,
                        animationDelay: `${d.delay}s`,
                      } as React.CSSProperties)
                    : { opacity: d.opacity }
                }
              />
            ))}
          </g>

          {/* Paper boats on the water — hover dims the others */}
          <g className={styles.starsGroup}>
            {wishPositions.map(({ wish, side, tier, bobDur, bobDelay, position }) => {
              const isActive = selectedWishId === wish.id;
              // above: clear of the peak; below: clear of the reflection
              const labelY = side < 0
                ? position.cy - 46 - tier * 16
                : position.cy + 56 + tier * 16;
              return (
                <g key={wish.id} className={styles.starNode}>
                  {isActive && (
                    <circle cx={position.cx} cy={position.cy} r={22} className={styles.nodeSelRing} />
                  )}
                  <g transform={`translate(${position.cx} ${position.cy})`}>
                    <g
                      className={styles.boatBob}
                      style={{ animationDuration: `${bobDur}s`, animationDelay: `${bobDelay}s` }}
                    >
                      <BoatGlyph level={wish.last_level} />
                    </g>
                  </g>
                  <circle
                    cx={position.cx}
                    cy={position.cy}
                    r={36}
                    fill="transparent"
                    className={styles.nodeHit}
                    onClick={() => handleNodeClick(wish)}
                    onMouseMove={(e) => handleMouseMove(e, wish)}
                    onMouseLeave={handleMouseLeave}
                  />
                  <text
                    x={position.cx}
                    y={labelY}
                    className={styles.nodeLabel}
                    textAnchor="middle"
                  >
                    {truncateTitle(wish.title, 8, 14)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <MapTooltip
          wish={tooltipWish}
          position={tooltipPosition}
          visible={showTooltip}
        />
      </div>
    </div>
  );
}
