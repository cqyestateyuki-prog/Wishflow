/**
 * WishSpace / 冥想空间
 * Click a wish drawing → it zooms up into a full-screen paper diorama.
 * The ink sinks into the paper, then every stroke re-draws itself — the
 * drawing comes alive — and the space sways gently in shallow 3D.
 *
 * No WebGL: the art is SVG line work, so stroke-dashoffset IS the "alive"
 * animation, and CSS perspective + real translateZ layers give the tunnel-
 * book depth. Honors prefers-reduced-motion and the app animation switch.
 */

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { LocalWish, settingsStore, wishStore } from '@/lib/localStore';
import { useLanguage } from '@/components/LanguageProvider';
import { getWishWhisper } from '@/lib/constants';
import { WishDomain, WishMood } from '@/lib/types';
import { generateWishSVG, renderSVGToString } from '@/lib/svgGenerator';
import { fileToCompressedDataUrl } from '@/lib/imageUpload';
import { supabase } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/apiBase';
import styles from './WishSpace.module.css';

type WishSpaceProps = {
  wish: LocalWish;
  /** Where the zoom starts from — the clicked artwork's bounding rect. */
  originRect?: DOMRect | null;
  onClose: () => void;
  /** Skip the ink-sink + stroke-by-stroke ritual: zoom straight into the
      living scene. Used by the homepage demo cards. */
  instantAlive?: boolean;
  /** When set (demo context), the text block shows a "Manifest this wish"
      CTA linking here instead of the replay button. */
  manifestHref?: string;
  /** Real wishes: a quiet "view details" action inside the space. */
  onDetails?: () => void;
  /** Real wishes: called after the art changes (upload / regenerate) so the
      parent list can refresh from storage. */
  onWishChange?: () => void;
};

type Phase = 'enter' | 'drawing' | 'alive';

// Same LCG as svgGenerator — motes stay put for the same wish forever.
function seededRandom(seedStr: string): () => number {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = ((seed << 5) - seed + seedStr.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed) || 1;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export default function WishSpace({ wish, originRect, onClose, instantAlive = false, manifestHref, onDetails, onWishChange }: WishSpaceProps) {
  const { language } = useLanguage();
  const [phase, setPhase] = useState<Phase>('enter');
  const [closing, setClosing] = useState(false);
  // Manifest scene: the art shrinks into a thought bubble above a meditating
  // figure — the wish held in the mind's eye. Available in the landing demo
  // and for real wishes alike.
  const [manifested, setManifested] = useState(false);

  // Icon-rail actions (real wishes only): swap in my own drawing, or ask for a
  // fresh AI one. Both confirm through a small paper modal first.
  const [activeModal, setActiveModal] = useState<null | 'upload' | 'regenerate'>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [modalNotice, setModalNotice] = useState('');
  // Overrides let the shown art switch the instant an action lands, before the
  // parent reloads the wish from storage.
  //   imageOverride: undefined = untouched · string = uploaded · null = cleared
  //   (a regenerate drops any user image so the new SVG shows through).
  const [imageOverride, setImageOverride] = useState<string | null | undefined>(undefined);
  const [svgOverride, setSvgOverride] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetWrapRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const animsRef = useRef<Animation[]>([]);
  const timersRef = useRef<number[]>([]);

  // Both low-stimulation degradations, read synchronously before first paint.
  const motionOff = useMemo(() => {
    if (typeof window === 'undefined') return true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced || !settingsStore.get().animationEnabled;
  }, []);

  // What art is actually shown: an in-session override wins over the stored
  // wish, so upload / regenerate switch the picture immediately.
  const effectiveImage = imageOverride !== undefined ? imageOverride : (wish.user_image ?? null);
  const effectiveSvg = svgOverride ?? wish.svg_data;

  // The artwork as an SVG string (AI art, or the deterministic fallback).
  // A user-uploaded raster drawing renders as <img> instead.
  const artHtml = useMemo(() => {
    if (effectiveImage) return null;
    if (effectiveSvg) return effectiveSvg;
    const domain = (wish.domain as WishDomain) || '生活';
    const mood = (wish.mood as WishMood) || '平静';
    return renderSVGToString(generateWishSVG(domain, mood, wish.line_seed || wish.title || wish.id));
  }, [effectiveImage, effectiveSvg, wish.domain, wish.mood, wish.line_seed, wish.title, wish.id]);

  const motes = useMemo(() => {
    const rand = seededRandom(wish.id);
    return Array.from({ length: 18 }, (_, i) => ({
      left: 4 + rand() * 92,
      top: 6 + rand() * 86,
      size: 1.2 + rand() * 1.3,
      dur: 3.5 + rand() * 3.5,
      delay: rand() * 6,
      near: i % 3 === 0,
    }));
  }, [wish.id]);

  const whisper = getWishWhisper(wish, language as 'en' | 'zh');

  // ── The signature moment: ink sinks, then every stroke re-draws itself ──
  const runDraw = useCallback(() => {
    const art = artRef.current;
    if (!art || motionOff) {
      setPhase('alive');
      return;
    }

    setPhase('drawing');

    // Raster drawing: no strokes to trace — develop it like wet ink drying.
    if (effectiveImage) {
      const a = art.animate(
        [
          { opacity: 0.15, filter: 'blur(10px)' },
          { opacity: 1, filter: 'blur(0px)' },
        ],
        { duration: 1700, easing: 'ease-out', fill: 'both' }
      );
      animsRef.current.push(a);
      a.finished.then(() => setPhase('alive')).catch(() => {});
      return;
    }

    const svg = art.querySelector('svg');
    if (!svg) {
      setPhase('alive');
      return;
    }

    // 1. Ink sinks into the paper (fade to a ghost, not a blank).
    const fadeOut = art.animate(
      [{ opacity: 1 }, { opacity: 0.04 }],
      { duration: 600, easing: 'ease-in', fill: 'forwards' }
    );
    animsRef.current.push(fadeOut);

    const beginStrokes = () => {
      if (!artRef.current) return;
      try {
        const shapes = Array.from(
          svg.querySelectorAll<SVGGraphicsElement>('path, circle, ellipse, line, polyline, rect')
        );
        const items = shapes.map(el => {
          let len = 0;
          try {
            len = (el as unknown as SVGGeometryElement).getTotalLength();
          } catch {
            len = 0;
          }
          const cs = window.getComputedStyle(el);
          const hasStroke = cs.stroke !== 'none' && parseFloat(cs.strokeWidth || '0') > 0 && len > 1;
          return { el, len: Math.min(len, 4000), hasStroke, baseOpacity: cs.opacity };
        });

        const n = items.length;
        const drawSpan = Math.min(6500, 2800 + n * 110); // stagger window
        let endAt = 0;
        const anims: Animation[] = [];

        // Hide everything inline first, then animate — one synchronous block,
        // so nothing flashes. 'important' beats the SVG's own dasharray attrs
        // (ant-line waves) and any CSS; original state returns on cleanup.
        items.forEach((it, i) => {
          const delay = n > 1 ? (i / (n - 1)) * drawSpan : 0;
          if (it.hasStroke) {
            const dur = Math.max(700, Math.min(2800, it.len * 5));
            it.el.style.setProperty('stroke-dasharray', `${it.len}`, 'important');
            it.el.style.setProperty('stroke-dashoffset', `${it.len}`, 'important');
            anims.push(
              it.el.animate(
                [{ strokeDashoffset: it.len }, { strokeDashoffset: 0 }],
                { duration: dur, delay, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'both' }
              )
            );
            endAt = Math.max(endAt, delay + dur);
          } else {
            it.el.style.setProperty('opacity', '0', 'important');
            anims.push(
              it.el.animate(
                [{ opacity: 0 }, { opacity: it.baseOpacity }],
                { duration: 900, delay: delay + 300, easing: 'ease-out', fill: 'both' }
              )
            );
            endAt = Math.max(endAt, delay + 1200);
          }
        });
        animsRef.current.push(...anims);

        // 2. Paper comes back to full presence while the first strokes land.
        const fadeIn = art.animate(
          [{ opacity: 0.04 }, { opacity: 1 }],
          { duration: 300, easing: 'ease-out', fill: 'forwards' }
        );
        animsRef.current.push(fadeIn);

        // 3. When the last stroke settles, hand the stage back to the SVG's
        // own gentle loops (wind / smoke / waves) — the drawing is now alive.
        // Sequenced on the animations' own clock, not wall time: if Chrome
        // throttles a covered window, the show waits and resumes intact.
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          anims.forEach(a => a.cancel());
          items.forEach(it => {
            it.el.style.removeProperty('stroke-dasharray');
            it.el.style.removeProperty('stroke-dashoffset');
            it.el.style.removeProperty('opacity');
          });
          setPhase('alive');
        };
        Promise.allSettled(anims.map(a => a.finished)).then(() => {
          timersRef.current.push(window.setTimeout(settle, 400));
        });
        // Safety net: never leave the space frozen mid-draw forever.
        timersRef.current.push(window.setTimeout(settle, endAt + 12000));
      } catch {
        // Whatever happens, the space must come alive — never stay frozen.
        setPhase('alive');
      }
    };

    // A quiet beat of near-blank paper before the first stroke lands.
    fadeOut.finished
      .then(() => {
        timersRef.current.push(window.setTimeout(beginStrokes, 350));
      })
      .catch(() => setPhase('alive'));
  }, [motionOff, effectiveImage]);

  // ── Entrance: FLIP zoom from the clicked card into the space ──
  useEffect(() => {
    if (motionOff) {
      setPhase('alive');
      return;
    }
    // Guard so the finished-handler and its wall-clock safety net can't
    // both kick off the draw sequence.
    let autoStarted = false;
    const startDraw = () => {
      if (autoStarted) return;
      autoStarted = true;
      if (instantAlive) {
        setPhase('alive');
      } else {
        runDraw();
      }
    };
    const wrap = sheetWrapRef.current;
    if (wrap && originRect) {
      const to = wrap.getBoundingClientRect();
      const dx = originRect.left + originRect.width / 2 - (to.left + to.width / 2);
      const dy = originRect.top + originRect.height / 2 - (to.top + to.height / 2);
      const s = Math.max(0.04, originRect.width / to.width);
      const a = wrap.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          { transform: 'translate(0px, 0px) scale(1)' },
        ],
        { duration: 780, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
      );
      animsRef.current.push(a);
      a.finished
        .then(() => {
          // Release the WAAPI transform (final frame = identity) so later
          // CSS transforms (the manifest shrink-into-bubble) can apply.
          a.cancel();
          timersRef.current.push(window.setTimeout(startDraw, 150));
        })
        .catch(() => {});
      timersRef.current.push(window.setTimeout(startDraw, 5000));
    } else {
      timersRef.current.push(window.setTimeout(startDraw, 380));
    }
    // Entrance runs exactly once, with the props it mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Shallow-3D parallax: pointer steers, idle sways on a slow tide ──
  useEffect(() => {
    if (motionOff) return;
    const stage = stageRef.current;
    if (!stage) return;

    const cur = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let pointer = false;
    const t0 = performance.now();

    const onMove = (e: PointerEvent) => {
      pointer = true;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointer = false;
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);

    let raf = 0;
    const tick = (now: number) => {
      if (!pointer) {
        // No pointer (touch devices, or hands off): a 17s/23s Lissajous sway.
        const t = (now - t0) / 1000;
        target.x = Math.sin((t / 17) * Math.PI * 2) * 0.28;
        target.y = Math.cos((t / 23) * Math.PI * 2) * 0.2;
      }
      cur.x += (target.x - cur.x) * 0.04;
      cur.y += (target.y - cur.y) * 0.04;
      stage.style.setProperty('--px', cur.x.toFixed(4));
      stage.style.setProperty('--py', cur.y.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [motionOff]);

  // Scroll lock + cleanup of every animation/timer we spawned.
  useLayoutEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const anims = animsRef.current;
    const timers = timersRef.current;
    return () => {
      document.body.style.overflow = prev;
      anims.forEach(a => a.cancel());
      timers.forEach(t => window.clearTimeout(t));
    };
  }, []);

  // ── Exit: zoom back down to where we came from ──
  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);

    const dur = motionOff ? 160 : 430;
    const overlay = overlayRef.current;
    if (overlay) {
      animsRef.current.push(
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: dur,
          easing: 'ease-in',
          fill: 'forwards',
        })
      );
    }
    const wrap = sheetWrapRef.current;
    if (!motionOff && wrap && originRect) {
      const to = wrap.getBoundingClientRect();
      const dx = originRect.left + originRect.width / 2 - (to.left + to.width / 2);
      const dy = originRect.top + originRect.height / 2 - (to.top + to.height / 2);
      const s = Math.max(0.04, originRect.width / to.width);
      animsRef.current.push(
        wrap.animate(
          [
            { transform: 'translate(0px, 0px) scale(1)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          ],
          { duration: dur, easing: 'cubic-bezier(0.5, 0, 0.75, 0.5)', fill: 'forwards' }
        )
      );
    }
    timersRef.current.push(window.setTimeout(onClose, dur + 40));
  }, [closing, motionOff, originRect, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // ── Real-wish actions: swap in my own drawing, or redraw with AI ──
  const closeModal = () => {
    setActiveModal(null);
    setModalNotice('');
  };

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      wishStore.update(wish.id, { user_image: dataUrl });
      setImageOverride(dataUrl); // the <img> branch shows it immediately
      setSvgOverride(null);
      setModalNotice('');
      setActiveModal(null);
      onWishChange?.();
    } catch {
      setModalNotice(
        language === 'zh' ? '这张图没读出来，换一张试试。' : "Couldn't read that image — try another."
      );
    }
  };

  const handleRegenerate = async () => {
    if (regenBusy) return;
    setRegenBusy(true);
    setModalNotice('');
    try {
      // Same call as /try: send the auth token when signed in so it counts
      // against the account quota (3/day), not the anonymous IP quota (1/day).
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch(apiUrl('/api/classify'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: wish.description || wish.title,
          generateSVG: true,
          language,
        }),
      });
      if (!response.ok) throw new Error('request-failed');
      const result = (await response.json()) as {
        svg?: string;
        quotaExceeded?: boolean;
        quota?: { used: number; limit: number };
      };

      // Quota spent: keep the modal open and say so gently, nothing replaced.
      if (result.quotaExceeded) {
        const lim = result.quota?.limit ?? 1;
        setModalNotice(
          language === 'zh'
            ? `今天的 ${lim} 张 AI 手绘用完了。${lim === 1 ? '登录后每天有 3 张。' : '明天再来看看。'}`
            : `You've used today's ${lim} AI drawing${lim > 1 ? 's' : ''}. ${lim === 1 ? 'Sign in for 3 a day.' : 'Come back tomorrow.'}`
        );
        return;
      }
      if (result.svg) {
        wishStore.update(wish.id, { svg_data: result.svg, user_image: null });
        setSvgOverride(result.svg); // feed the artHtml memo the fresh SVG
        setImageOverride(null); // and drop any user image so it shows through
        setModalNotice('');
        setActiveModal(null);
        onWishChange?.();
      } else {
        setModalNotice(
          language === 'zh' ? '这次没画成，过会再试。' : "Couldn't draw this time — try again in a bit."
        );
      }
    } catch {
      setModalNotice(
        language === 'zh' ? '这次没画成，过会再试。' : "Couldn't draw this time — try again in a bit."
      );
    } finally {
      setRegenBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const overlayClass = motionOff ? `${styles.overlay} ${styles.still}` : styles.overlay;
  // While drawing, the SVG's own loops (wind / smoke / waves) hold still;
  // at 'alive' the pause lifts and they take over, plus a whisper of float.
  const artClass =
    phase === 'alive'
      ? motionOff
        ? styles.art
        : `${styles.art} ${styles.artFloat}`
      : `${styles.art} ${styles.pauseAnims}`;
  const textClass =
    phase === 'alive' && !closing ? `${styles.textBlock} ${styles.textAlive}` : styles.textBlock;

  return createPortal(
    <div
      ref={overlayRef}
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-label={wish.title}
      onClick={e => {
        // Portal events still bubble through the React tree — don't let a
        // click in the space reach (and close) the detail modal beneath it.
        e.stopPropagation();
        if ((e.target as Element).closest('[data-keep]')) return;
        handleClose();
      }}
    >
      <div className={styles.scene}>
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.mistFar} />
          <div className={styles.mistNear} />

          <div className={styles.motesFar}>
            {motes.filter(m => !m.near).map((m, i) => (
              <span
                key={i}
                className={styles.mote}
                style={{
                  left: `${m.left}%`,
                  top: `${m.top}%`,
                  width: m.size,
                  height: m.size,
                  ['--dur' as string]: `${m.dur}s`,
                  ['--delay' as string]: `${m.delay}s`,
                }}
              />
            ))}
          </div>

          <div className={styles.content}>
            <div className={styles.halo} />
            {/* The stage fills the viewport — the drawing IS the space. */}
            <div
              ref={sheetWrapRef}
              className={manifested ? `${styles.artStage} ${styles.artToBubble}` : styles.artStage}
            >
              {effectiveImage ? (
                <div ref={artRef} className={artClass}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={effectiveImage} alt={wish.title} />
                </div>
              ) : (
                <div
                  ref={artRef}
                  className={artClass}
                  dangerouslySetInnerHTML={{ __html: artHtml || '' }}
                />
              )}
            </div>

            {/* Manifest scene: thought bubble + meditating figure. Rendered for
                the demo and real wishes alike — invisible until manifested. */}
            <div
              className={manifested ? `${styles.manifestLayer} ${styles.manifestOn}` : styles.manifestLayer}
              aria-hidden="true"
            >
                <svg className={styles.bubble} viewBox="0 0 210 226">
                  <g fill="none" stroke="#2E2B33" strokeLinecap="round">
                    {/* hand-drawn thought bubble, gently irregular */}
                    <path
                      d="M 104 10 C 150 6 196 42 198 96 C 200 148 158 190 106 192 C 52 194 12 152 10 98 C 8 46 54 12 104 10 Z"
                      strokeWidth="2.2"
                    />
                    <circle cx="42" cy="204" r="6" strokeWidth="1.8" />
                    <circle cx="26" cy="219" r="3.4" strokeWidth="1.6" />
                  </g>
                </svg>
                <svg className={styles.meditator} viewBox="0 0 120 92">
                  <g fill="none" stroke="#2E2B33" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M 51 20 A 10.5 10.5 0 1 1 71.9 19.2 A 10.5 10.5 0 1 1 51 20 Z" strokeWidth="2.1" />
                    <path d="M 52 12.5 Q 60 5 70 10.5" strokeWidth="1.8" />
                    <path d="M 55 30 Q 46 40 43 54 Q 42 60 40 63" />
                    <path d="M 66 30 Q 75 40 78 54 Q 79 60 81 63" />
                    <path d="M 40 63 Q 36 70 46 72 Q 60 76 74 72 Q 84 70 81 63" strokeWidth="2.6" />
                    <path d="M 47 68 Q 60 61 74 68" strokeWidth="2" />
                    <path d="M 45 46 Q 38 55 44 64" strokeWidth="1.9" />
                    <path d="M 76 46 Q 83 55 77 64" strokeWidth="1.9" />
                    <path d="M 32 84 L 89 84" stroke="#B5A8D0" strokeWidth="1.4" strokeDasharray="5 6" />
                  </g>
                </svg>
              </div>

            <div className={textClass} data-keep>
              <h2 className={styles.title}>{wish.title}</h2>
              <p className={styles.whisper}>
                {manifested
                  ? language === 'zh'
                    ? '先在心里，把它完整地过一遍。'
                    : 'Hold it in your mind, whole, for a moment.'
                  : whisper}
              </p>
              {manifestHref ? (
                manifested ? (
                  <a className={styles.manifestBtn} href={manifestHref}>
                    {language === 'zh' ? '创建我的愿望' : 'Create my wish'}
                  </a>
                ) : (
                  <button className={styles.manifestBtn} onClick={() => setManifested(true)}>
                    {language === 'zh' ? '显化这个愿望' : 'Manifest this wish'}
                  </button>
                )
              ) : manifested ? (
                // Real wish, held in the mind's eye: just look, then come back.
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {onDetails && (
                    <button className={styles.replayBtn} onClick={onDetails}>
                      {language === 'zh' ? '查看详情' : 'View details'}
                    </button>
                  )}
                  <button className={styles.replayBtn} onClick={() => setManifested(false)}>
                    {language === 'zh' ? '回来' : 'Back'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className={styles.manifestBtn} onClick={() => setManifested(true)}>
                    {language === 'zh' ? '显化这个愿望' : 'Manifest this wish'}
                  </button>
                  {!effectiveImage && !motionOff && (
                    <button className={styles.replayBtn} onClick={runDraw}>
                      {language === 'zh' ? '让它再画一次' : 'Draw it once more'}
                    </button>
                  )}
                  {onDetails && (
                    <button className={styles.replayBtn} onClick={onDetails}>
                      {language === 'zh' ? '查看详情' : 'View details'}
                    </button>
                  )}
                </div>
              )}
              <p className={styles.leaveHint}>
                {language === 'zh' ? '点画外任意处，随时离开' : 'Tap anywhere outside to leave, anytime'}
              </p>
            </div>
          </div>

          <div className={styles.motesNear}>
            {motes.filter(m => m.near).map((m, i) => (
              <span
                key={i}
                className={styles.mote}
                style={{
                  left: `${m.left}%`,
                  top: `${m.top}%`,
                  width: m.size + 0.8,
                  height: m.size + 0.8,
                  ['--dur' as string]: `${m.dur}s`,
                  ['--delay' as string]: `${m.delay}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.vignette} />
      <div className={styles.grain} />

      <button
        className={styles.closeBtn}
        data-keep
        onClick={handleClose}
        aria-label={language === 'zh' ? '离开冥想空间' : 'Leave the space'}
      >
        ×
      </button>

      {/* Real-wish tools, tucked under the close button: swap in my own drawing,
          or redraw with AI. Hidden in the landing demo (those aren't stored). */}
      {!manifestHref && (
        <>
          <div className={styles.iconRail}>
            <button
              className={styles.iconBtn}
              data-keep
              onClick={(e) => {
                e.stopPropagation();
                setModalNotice('');
                setActiveModal('upload');
              }}
              aria-label={language === 'zh' ? '上传我画的图' : 'Upload my own drawing'}
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                <circle cx="7.5" cy="8.5" r="1.3" />
                <path d="M13 17.5 L13 10" />
                <path d="M10 12.5 L13 9.5 L16 12.5" />
              </svg>
            </button>
            <button
              className={styles.iconBtn}
              data-keep
              onClick={(e) => {
                e.stopPropagation();
                setModalNotice('');
                setActiveModal('regenerate');
              }}
              aria-label={language === 'zh' ? '重新生成图' : 'Regenerate image'}
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            data-keep
            style={{ display: 'none' }}
          />

          {activeModal && (
            <div
              className={styles.modalOverlay}
              data-keep
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
            >
              <div className={styles.modalCard} data-keep onClick={(e) => e.stopPropagation()}>
                {activeModal === 'upload' ? (
                  <>
                    <h3 className={styles.modalTitle}>
                      {language === 'zh' ? '换成我画的' : 'Use my own drawing'}
                    </h3>
                    <p className={styles.modalBody}>
                      {language === 'zh'
                        ? '选择一张图片替换当前的画。随时可以在详情里还原成生成的图。'
                        : 'Pick an image to replace this drawing. You can revert to the generated art anytime from details.'}
                    </p>
                    {modalNotice && <p className={styles.modalNote}>{modalNotice}</p>}
                    <div className={styles.modalActions}>
                      <button className={styles.modalCancelBtn} onClick={closeModal}>
                        {language === 'zh' ? '取消' : 'Cancel'}
                      </button>
                      <button
                        className={styles.manifestBtn}
                        style={{ marginTop: 0 }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {language === 'zh' ? '选择图片' : 'Choose image'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className={styles.modalTitle}>
                      {language === 'zh' ? '重新生成这幅画' : 'Redraw this wish'}
                    </h3>
                    <p className={styles.modalBody}>
                      {language === 'zh'
                        ? '会用掉今天的一次 AI 手绘额度，当前的画会被替换。'
                        : "This uses one of today's AI drawings and replaces the current art."}
                    </p>
                    {modalNotice && <p className={styles.modalNote}>{modalNotice}</p>}
                    <div className={styles.modalActions}>
                      <button className={styles.modalCancelBtn} onClick={closeModal}>
                        {language === 'zh' ? '取消' : 'Cancel'}
                      </button>
                      <button
                        className={styles.manifestBtn}
                        style={{ marginTop: 0, opacity: regenBusy ? 0.7 : 1 }}
                        onClick={handleRegenerate}
                        disabled={regenBusy}
                      >
                        {regenBusy
                          ? (language === 'zh' ? '画着呢…' : 'Drawing…')
                          : (language === 'zh' ? '重新生成' : 'Regenerate')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
