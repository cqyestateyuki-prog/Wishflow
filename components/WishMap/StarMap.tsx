/**
 * StarMap Component / 星图组件
 * Displays wishes as softly glowing star-bodies on hand-drawn wobbly
 * life-stage orbits around the wish core.
 * 将愿望显示为手绘颤动轨道上的柔光星体
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { LocalWish } from '@/lib/localStore';
import { useLanguage } from '@/components/LanguageProvider';
import { useSettings } from '@/hooks/useSettings';
import MapTooltip from './MapTooltip';
import { makeDust, truncateTitle, resolveCollisions } from './artUtils';
import styles from './WishMap.module.css';

type StarMapProps = {
  wishes: LocalWish[];
  selectedWishId?: string | null;
  onWishSelect?: (wish: LocalWish) => void;
  onWishClick?: (wish: LocalWish) => void;
};

const WIDTH = 960;
const HEIGHT = 780;
const CENTER_X = 480;
const CENTER_Y = 380;
// Vertical compression of orbits for a gentle look-down perspective
const RY_FACTOR = 0.84;


// Normalize stage to one of the 5 main rings
function normalizeStageForStar(stage: string | null): string {
  if (!stage) return '25-35';
  if (stage === '一生' || stage === 'lifetime' || stage === '现在-未来十年') {
    return '25-35';
  }
  if (stage.includes('13') && stage.includes('18')) return '13-18';
  if (stage.includes('18') && stage.includes('25')) return '18-25';
  if (stage.includes('25') && stage.includes('35')) return '25-35';
  if (stage.includes('35') && stage.includes('50')) return '35-50';
  if (stage.includes('50')) return '50+';
  return '25-35';
}

const RING_RADII: Record<string, number> = {
  '13-18': 100,
  '18-25': 170,
  '25-35': 240,
  '35-50': 300,
  '50+': 350,
};

const RING_ORDER = ['13-18', '18-25', '25-35', '35-50', '50+'];

// ── A real galaxy: two logarithmic spiral arms, r = A·e^(Bθ) ──
// Life stages are radius bands; wishes are stars strung along the arms.
const SPIRAL_A = 62;
const SPIRAL_B = 0.3;
const ARM_PHASES = [0, Math.PI];
const thetaAtR = (r: number) => Math.log(r / SPIRAL_A) / SPIRAL_B;

function makeArmPath(phase: number, seed: number): string {
  const pts: string[] = [];
  const maxTheta = thetaAtR(372);
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let t = 0; t <= maxTheta + 0.001; t += 0.12) {
    const wob = 1 + (rand() - 0.5) * 0.05;
    const r = SPIRAL_A * Math.exp(SPIRAL_B * t) * wob;
    const x = CENTER_X + Math.cos(t + phase) * r;
    const y = CENTER_Y + Math.sin(t + phase) * r * RY_FACTOR;
    pts.push(`${pts.length ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

const ARMS = ARM_PHASES.map((p, i) => makeArmPath(p, 77 + i * 31));

// The milky band: dense star-dust scattered along each arm; roughly a
// quarter of the specks twinkle (≥3.2s periods, staggered) so the whole
// stream feels alive without ever flickering.
type ArmSpeck = { x: number; y: number; r: number; o: number; tw: boolean; dur: number; delay: number };
function makeArmDust(): ArmSpeck[] {
  const out: ArmSpeck[] = [];
  let s = 12345;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ARM_PHASES.forEach(phase => {
    const maxTheta = thetaAtR(368);
    for (let t = 0.25; t < maxTheta; t += 0.085) {
      if (rand() < 0.3) continue;
      const r = SPIRAL_A * Math.exp(SPIRAL_B * t);
      const spread = 10 + r * 0.07;
      const rr = r + (rand() - 0.5) * spread * 2;
      const x = CENTER_X + Math.cos(t + phase) * rr;
      const y = CENTER_Y + Math.sin(t + phase) * rr * RY_FACTOR;
      out.push({
        x, y,
        r: 0.7 + rand() * 1.5,
        o: 0.12 + rand() * 0.4,
        tw: rand() < 0.26,
        dur: 3.2 + rand() * 3.4,
        delay: rand() * 6,
      });
    }
  });
  return out;
}
const ARM_DUST = makeArmDust();

// Sparse background specks beyond the arms
const DUST = makeDust(WIDTH, HEIGHT, 22, 7);

// A wish sits ON an arm at its life-stage radius; stage-mates slide inward /
// outward along the arm and alternate between the two arms — a star stream,
// never a queue on a circle.
function getNodePosition(
  normalizedStage: string,
  indexInRing: number,
  totalInRing: number,
  ringIndex: number
): { cx: number; cy: number; labelDy: number } {
  const baseR = RING_RADII[normalizedStage] || 240;
  const arm = (indexInRing + ringIndex) % ARM_PHASES.length;
  const phase = ARM_PHASES[arm];
  const step = Math.ceil(indexInRing / 2) * (indexInRing % 2 === 1 ? 34 : -34);
  const r = Math.min(362, Math.max(70, baseR + step));
  const theta = thetaAtR(r);
  return {
    cx: CENTER_X + Math.cos(theta + phase) * r,
    cy: CENTER_Y + Math.sin(theta + phase) * r * RY_FACTOR,
    // labels alternate above/below their star so arm-neighbours never collide
    labelDy: indexInRing % 2 === 0 ? -14 : 22,
  };
}

// Ink-drawn star glyphs — contrast comes from solid ink and line detail, not
// glow. Depth of connection = richer drawing: hollow dot → dot+ring → dot+
// ring+rays, in deepening ink purples (2026-07-10 去脏提对比改版).
function StarGlyph({ cx, cy, level }: { cx: number; cy: number; level: string | null }) {
  const deep = level === 'deep';
  const mid = level === 'normal';
  if (!deep && !mid) {
    return <circle cx={cx} cy={cy} r={5} fill="#FAF9F7" stroke="#7E6CA8" strokeWidth={2} />;
  }
  const body = deep ? '#4A3D70' : '#5B4B84';
  return (
    <>
      <circle cx={cx} cy={cy} r={deep ? 6 : 5.5} fill={body} />
      <circle cx={cx} cy={cy} r={deep ? 10.5 : 9} fill="none" stroke={body} strokeWidth={deep ? 1.3 : 1.1} opacity={0.5} />
      {deep && (
        <path
          d={`M ${cx} ${cy - 13} L ${cx} ${cy - 18} M ${cx + 13} ${cy} L ${cx + 18} ${cy} M ${cx} ${cy + 13} L ${cx} ${cy + 18} M ${cx - 13} ${cy} L ${cx - 18} ${cy}`}
          stroke={body} strokeWidth={1.6} strokeLinecap="round" opacity={0.75}
        />
      )}
    </>
  );
}

// Wobbly bezier link from the core to a node
function makeWobblyLink(toX: number, toY: number): string {
  const mid1X = (CENTER_X + toX) / 2 + 18;
  const mid1Y = (CENTER_Y + toY) / 2 - 14;
  const mid2X = (CENTER_X + toX) / 2 - 12;
  const mid2Y = (CENTER_Y + toY) / 2 + 16;
  return `M ${CENTER_X} ${CENTER_Y} C ${mid1X} ${mid1Y}, ${mid2X} ${mid2Y}, ${toX} ${toY}`;
}

export default function StarMap({ wishes, selectedWishId, onWishSelect, onWishClick }: StarMapProps) {
  const { language } = useLanguage();
  const { settings } = useSettings();
  const [tooltipWish, setTooltipWish] = useState<LocalWish | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  const wishesByRing = useMemo(() => {
    const grouped: Record<string, LocalWish[]> = {};
    wishes.forEach(wish => {
      const ring = normalizeStageForStar(wish.stage);
      if (!grouped[ring]) grouped[ring] = [];
      grouped[ring].push(wish);
    });
    return grouped;
  }, [wishes]);

  const nodePositions = useMemo(() => {
    const nodes = wishes.map(wish => {
      const ring = normalizeStageForStar(wish.stage);
      const ringWishes = wishesByRing[ring] || [];
      const indexInRing = ringWishes.findIndex(w => w.id === wish.id);
      const ringIndex = RING_ORDER.indexOf(ring);
      return {
        wish,
        position: getNodePosition(ring, indexInRing, ringWishes.length, ringIndex >= 0 ? ringIndex : 2),
      };
    });
    // Stars may share an arm, never a spot
    resolveCollisions(nodes.map(n => n.position), 56);
    return nodes;
  }, [wishes, wishesByRing]);

  const selectedPosition = useMemo(() => {
    if (!selectedWishId) return null;
    const found = nodePositions.find(n => n.wish.id === selectedWishId);
    return found?.position || null;
  }, [selectedWishId, nodePositions]);

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
    <div className={containerClass}>
      <div className={styles.mapTop}>
        <b>{language === 'zh' ? '愿力星图' : 'Wish Galaxy'}</b>
        <div className={styles.legend}>
          <span><span className={`${styles.legendDot} ${styles.legendDotLow}`}></span>{language === 'zh' ? '最低' : 'Min'}</span>
          <span><span className={`${styles.legendDot} ${styles.legendDotMid}`}></span>{language === 'zh' ? '正常' : 'Normal'}</span>
          <span><span className={`${styles.legendDot} ${styles.legendDotDeep}`}></span>{language === 'zh' ? '深度' : 'Deep'}</span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.svgCanvas}
          style={{ height: HEIGHT }}
          role="img"
          aria-label={language === 'zh' ? '愿力地图（星图）' : 'Wish Map (Star)'}
        >
          {/* No nebula washes, no gradient fills — clean paper, ink lines only.
              The old full-canvas purple gradients read as grime (2026-07-10). */}

          <defs>
            {/* The galaxy's soft heart — one same-family radial, whisper-low */}
            <radialGradient id="sm-corehaze">
              <stop offset="0%" stopColor="rgba(145, 127, 185, 0.22)" />
              <stop offset="50%" stopColor="rgba(145, 127, 185, 0.05)" />
              <stop offset="100%" stopColor="rgba(145, 127, 185, 0)" />
            </radialGradient>
            {/* Negative-space halo:每颗星周围挖掉轨道与尘埃,星坐在一小片
                干净留白里,自己就亮(古典星图的纸媒之光) */}
            <mask id="sm-holes">
              <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#fff" />
              {nodePositions.map(({ wish, position }) => (
                <circle key={wish.id} cx={position.cx} cy={position.cy} r={18} fill="#000" />
              ))}
            </mask>
            {/* Draw-on reveal for the selected link (remounts per selection) */}
            {selectedPosition && (
              <mask id="sm-link-reveal">
                <path
                  key={selectedWishId}
                  d={makeWobblyLink(selectedPosition.cx, selectedPosition.cy)}
                  pathLength={1}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeDasharray="1 1"
                  className={styles.linkReveal}
                />
              </mask>
            )}
          </defs>

          <g mask="url(#sm-holes)">
            {/* Starfield dust */}
            <g aria-hidden="true">
              {DUST.map((d, i) => (
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

            {/* Galactic core haze — the soft heart of the spiral */}
            <ellipse
              className={styles.coreHaze}
              cx={CENTER_X}
              cy={CENTER_Y}
              rx={82}
              ry={82 * RY_FACTOR}
              fill="url(#sm-corehaze)"
              aria-hidden="true"
            />

            {/* The two spiral arms — each an ink stream with a quiet
                companion line, the same double-stroke voice as the river */}
            {ARMS.map((d, i) => (
              <g key={`arm-${i}`}>
                <path
                  d={d}
                  className={styles.galaxyArmSoft}
                  transform={`translate(${i === 0 ? 6 : -6} ${i === 0 ? 5 : -5})`}
                />
                <path
                  d={d}
                  className={styles.galaxyArm}
                  style={{ animationDelay: `${i * -14}s` }}
                />
              </g>
            ))}

            {/* The milky band along the arms — a quarter of it twinkling */}
            <g aria-hidden="true">
              {ARM_DUST.map((d, i) => (
                <circle
                  key={`ad-${i}`}
                  cx={d.x}
                  cy={d.y}
                  r={d.r}
                  fill="#9B8FC4"
                  className={d.tw ? styles.dustTwinkle : undefined}
                  style={
                    d.tw
                      ? ({
                          '--dust-base': d.o,
                          animationDuration: `${d.dur}s`,
                          animationDelay: `${d.delay}s`,
                        } as React.CSSProperties)
                      : { opacity: d.o }
                  }
                />
              ))}
            </g>
          </g>

          {/* Stage labels riding the first arm outward */}
          {RING_ORDER.map((stage) => {
            const r = RING_RADII[stage];
            const t = thetaAtR(r);
            return (
              <text
                key={`label-${stage}`}
                x={CENTER_X + Math.cos(t) * r}
                y={CENTER_Y + Math.sin(t) * r * RY_FACTOR - 14}
                textAnchor="middle"
                className={styles.ringLabel}
              >
                {stage}
              </text>
            );
          })}

          {/* Core — a compass sun drawn in ink: paper disc, dashed inner ring,
              and eight breathing tick marks instead of a glow halo */}
          <g className={styles.coreTicks} aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={CENTER_X + Math.cos(a) * 54}
                  y1={CENTER_Y + Math.sin(a) * 54}
                  x2={CENTER_X + Math.cos(a) * 61}
                  y2={CENTER_Y + Math.sin(a) * 61}
                />
              );
            })}
          </g>
          <circle cx={CENTER_X} cy={CENTER_Y} r={46} fill="#FFFFFF" stroke="#5B4B84" strokeWidth={2} />
          <circle cx={CENTER_X} cy={CENTER_Y} r={39} fill="none" stroke="rgba(91, 75, 132, 0.35)" strokeWidth={1.2} strokeDasharray="5 6" />
          <text x={CENTER_X} y={CENTER_Y - 4} textAnchor="middle" className={styles.coreText}>
            {language === 'zh' ? '你' : 'You'}
          </text>
          <text x={CENTER_X} y={CENTER_Y + 18} textAnchor="middle" className={styles.axisText}>
            {language === 'zh' ? '愿力源核' : 'Core'}
          </text>

          {/* Dashed ink link to the selected wish — drawn on in ~500ms via the
              reveal mask, then keeps its slow dash drift */}
          {selectedPosition && (
            <path
              className={styles.link}
              d={makeWobblyLink(selectedPosition.cx, selectedPosition.cy)}
              mask="url(#sm-link-reveal)"
              style={{ opacity: 1 }}
            />
          )}

          {/* Wish stars — ink glyphs, hover scales + dims the other stars
              (focus by subtraction, not glow), selection gets a slow rotating
              dashed ring */}
          <g className={styles.starsGroup}>
          {nodePositions.map(({ wish, position }) => {
            const isActive = selectedWishId === wish.id;
            return (
              <g key={wish.id} className={styles.starNode}>
                {isActive && (
                  <circle
                    cx={position.cx}
                    cy={position.cy}
                    r={16}
                    className={styles.nodeSelRing}
                  />
                )}
                <g className={styles.nodeGlyph}>
                  <StarGlyph cx={position.cx} cy={position.cy} level={wish.last_level} />
                </g>
                <circle
                  cx={position.cx}
                  cy={position.cy}
                  r={15}
                  fill="transparent"
                  className={styles.nodeHit}
                  onClick={() => handleNodeClick(wish)}
                  onMouseMove={(e) => handleMouseMove(e, wish)}
                  onMouseLeave={handleMouseLeave}
                />
                <text
                  x={position.cx}
                  y={position.cy + position.labelDy}
                  textAnchor="middle"
                  className={styles.nodeLabel}
                >
                  {truncateTitle(wish.title, 8, 16)}
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
