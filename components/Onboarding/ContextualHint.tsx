/**
 * ContextualHint / 情境化首访提示 · 手写便签气泡
 *
 * One gentle handwritten speech bubble that appears the first time a user
 * naturally arrives on a page, pointing softly at the feature that lives
 * there. Not a forced tour — each page mounts exactly one hint, in context.
 *
 * Philosophy (DESIGN_SYSTEM.md §0 · for highly sensitive souls):
 *   - the scrim is a whisper of warm paper tint, never a dark gauntlet, and
 *     lets clicks pass straight through (pointer-events: none) — never traps.
 *   - always dismissable: an always-visible "知道了 / Got it", a quiet
 *     "跳过引导 / Skip tips", and Esc. Low-stimulation: opacity-only entrance,
 *     prefers-reduced-motion honoured.
 *
 * First-visit is remembered per hint in localStorage:
 *   wishflow_hint_create_v1 · wishflow_hint_gallery_v1 · wishflow_hint_today_v1
 * "Skip tips" sets all three at once. Clear a key to replay that hint (handy
 * for demo screenshots).
 */
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import styles from './ContextualHint.module.css';

export type HintId = 'create' | 'gallery' | 'today';

// Every first-visit hint in the product — "Skip tips" silences them all.
export const HINT_IDS: HintId[] = ['create', 'gallery', 'today'];
export const hintKey = (id: string) => `wishflow_hint_${id}_v1`;

const MOBILE_MAX = 560;

type ContextualHintProps = {
  hintId: HintId;
  /** data-onboard value of the element to point at. */
  target: string;
  zh: string;
  en: string;
  place?: 'above' | 'below';
  /** tiny hand-placed tilt (serif-italic, no cursive font is loaded) */
  rot?: number;
};

type Pos = {
  top: number;
  left: number;
  tail: 'up' | 'down' | 'none';
  tailLeft: number;
  ready: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function ContextualHint({
  hintId,
  target,
  zh: zhText,
  en: enText,
  place = 'below',
  rot = -1,
}: ContextualHintProps) {
  const { language } = useLanguage();
  const zh = language === 'zh';

  const [active, setActive] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, tail: 'none', tailLeft: 0, ready: false });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // First-visit detection — show only when this hint's flag is absent.
  useEffect(() => {
    let seen = false;
    try {
      seen = !!window.localStorage.getItem(hintKey(hintId));
    } catch {
      seen = false;
    }
    if (seen) return;
    setAnimate(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // A short settle delay so the page has laid out before we measure.
    const t = window.setTimeout(() => setActive(true), 450);
    return () => window.clearTimeout(t);
  }, [hintId]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(hintKey(hintId), '1');
    } catch {
      /* storage may be unavailable (private mode); still hide the hint */
    }
    setActive(false);
  }, [hintId]);

  const dismissAll = useCallback(() => {
    try {
      HINT_IDS.forEach((id) => window.localStorage.setItem(hintKey(id), '1'));
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  const measure = useCallback(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const m = 12; // viewport margin

    // On mobile, center and stack (no tail) rather than overflow.
    const el = vw > MOBILE_MAX ? document.querySelector<HTMLElement>(`[data-onboard="${target}"]`) : null;
    const r = el?.getBoundingClientRect();
    const onscreen = !!r && (r.width > 0 || r.height > 0) && r.bottom > 0 && r.top < vh;

    if (!r || !onscreen) {
      // Graceful fallback: centered bubble, no tail — never point at nothing.
      setPos({
        top: clamp(vh / 2 - bh / 2, m, Math.max(m, vh - bh - m)),
        left: clamp(vw / 2 - bw / 2, m, Math.max(m, vw - bw - m)),
        tail: 'none',
        tailLeft: 0,
        ready: true,
      });
      return;
    }

    const cx = r.left + r.width / 2;
    const left = clamp(cx - bw / 2, m, Math.max(m, vw - bw - m));
    const gap = 16;

    let top: number;
    let tail: 'up' | 'down';
    if (place === 'above') {
      top = r.top - bh - gap;
      tail = 'down';
      if (top < m) {
        top = r.bottom + gap;
        tail = 'up';
      }
    } else {
      top = r.bottom + gap;
      tail = 'up';
      if (top + bh > vh - m) {
        top = r.top - bh - gap;
        tail = 'down';
      }
    }
    top = clamp(top, m, Math.max(m, vh - bh - m));
    const tailLeft = clamp(cx - left, 22, Math.max(22, bw - 22));
    setPos({ top, left, tail, tailLeft, ready: true });
  }, [target, place]);

  // Measure before paint; re-measure on resize / scroll (rAF-throttled).
  useLayoutEffect(() => {
    if (!active) return;
    measure();
    let ticking = false;
    const onWin = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        measure();
      });
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [active, language, measure]);

  // Esc dismisses this hint (and sets its flag) — never trap the user.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, dismiss]);

  if (!active) return null;

  return (
    <div className={styles.root}>
      <div className={styles.scrim} />
      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="false"
        aria-label={zh ? '小提示' : 'Tip'}
        className={`${styles.bubble} ${animate ? styles.enter : ''}`}
        style={{
          top: pos.top,
          left: pos.left,
          transform: `rotate(${rot}deg)`,
          visibility: pos.ready ? 'visible' : 'hidden',
        }}
      >
        {pos.tail !== 'none' && (
          <span
            aria-hidden="true"
            className={`${styles.tail} ${pos.tail === 'up' ? styles.tailUp : styles.tailDown}`}
            style={{ left: pos.tailLeft }}
          />
        )}
        <p className={styles.text} aria-live="polite">
          {zh ? zhText : enText}
        </p>
        <div className={styles.footer}>
          <button type="button" className={styles.skipAll} onClick={dismissAll}>
            {zh ? '跳过引导' : 'Skip tips'}
          </button>
          <button type="button" className={`btn solid ${styles.gotIt}`} onClick={dismiss}>
            {zh ? '知道了' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
