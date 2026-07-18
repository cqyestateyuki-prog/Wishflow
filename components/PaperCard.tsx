/**
 * PaperCard / 纸卡外壳
 * The single wish-card shell shared by the landing arc and the Wish Gallery:
 * white sheet + hand-drawn paper clip + seeded lean. Content (artwork, title,
 * caption) is up to the caller — this component owns only the paper.
 */

'use client';

import styles from './PaperCard.module.css';

type PaperCardProps = {
  /** Seeded lean in degrees. Ignored when manageTransform is false. */
  tilt?: number;
  /** Where the clip is pinned along the top edge (px). */
  clipLeft?: number;
  /** Extra clip rotation on top of the tilt (deg). */
  clipRot?: number;
  /** Slight per-card size variance (0.95–1.05). */
  scale?: number;
  /**
   * When false, the shell sets NO transform of its own — for the landing arc,
   * whose scroll loop writes transforms per frame.
   */
  manageTransform?: boolean;
  clickable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
  role?: string;
  'aria-label'?: string;
  children: React.ReactNode;
};

export default function PaperCard({
  tilt = 0,
  clipLeft = 18,
  clipRot = 37,
  scale = 1,
  manageTransform = true,
  clickable = false,
  onClick,
  cardRef,
  className,
  style,
  role,
  'aria-label': ariaLabel,
  children,
}: PaperCardProps) {
  const cls = [
    styles.card,
    manageTransform ? styles.managed : '',
    clickable ? styles.clickable : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={cardRef}
      className={cls}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
      style={{
        ['--tilt' as string]: `${tilt}deg`,
        ['--clipLeft' as string]: `${clipLeft}px`,
        ['--clipRot' as string]: `${clipRot}deg`,
        ['--cardScale' as string]: String(scale),
        ...style,
      }}
    >
      <div className={styles.sheet} aria-hidden="true" />
      <svg className={styles.clip} viewBox="0 0 35 51" aria-hidden="true">
        <path
          d="M13 8 Q13 3 18.5 3 Q24 3 24 9 L24 40 Q24 48 17.5 48 Q11 48 11 40 L11 16 Q11 11.5 15 11.5 Q19 11.5 19 16 L19 38"
          fill="none"
          stroke="#5B4B84"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
