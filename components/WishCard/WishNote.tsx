/**
 * WishNote / 愿望便签 — the reusable wish card.
 * Same PaperCard shell as the landing page's demo cards, and the same opening
 * behavior: tap anywhere on the sheet → zoom straight into the living
 * meditation space (instantAlive), identical to the landing experience.
 * Self-contained: the card manages its own WishSpace. Pass `onClick` to
 * override the tap entirely (e.g. overview's login prompt), and `onDetails`
 * to offer a "view details" action inside the space.
 */

'use client';

import { useState } from 'react';
import { LocalWish } from '@/lib/localStore';
import { PinIcon, PinIconSolid } from '../Icons';
import PaperCard from '@/components/PaperCard';
import WishSpace from '@/components/WishSpace';
import WishVisualization from './WishVisualization';
import styles from './WishCard.module.css';

type WishNoteProps = {
  wish: LocalWish;
  active?: boolean;
  /** Override the tap entirely (default: open the meditation space). */
  onClick?: () => void;
  onPinToggle?: (wishId: string) => void;
  /** Offered as a quiet "view details" action inside the space. */
  onDetails?: (wish: LocalWish) => void;
};

export default function WishNote({ wish, active = false, onClick, onPinToggle, onDetails }: WishNoteProps) {
  const [spaceRect, setSpaceRect] = useState<DOMRect | null>(null);

  // Seeded irregularity — a note keeps its own angle, size and clip spot
  // forever, like a real sheet someone pinned by hand.
  const seed = Array.from(wish.id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const tilt = ((seed % 7) - 3) * 0.6; // -1.8° … 1.8°
  const scale = 1 + ((seed % 5) - 2) * 0.02; // 0.96 … 1.04
  const clipLeft = 14 + (seed % 4) * 18;
  const clipRot = 37 + ((seed % 3) - 1) * 5;

  return (
    <>
      <PaperCard
        tilt={tilt}
        scale={scale}
        clipLeft={clipLeft}
        clipRot={clipRot}
        clickable
        onClick={(e) => {
          if (onClick) onClick();
          else setSpaceRect(e.currentTarget.getBoundingClientRect());
        }}
        className={active ? styles.noteActive : undefined}
        style={{ padding: '30px 16px 14px' }}
      >
        <WishVisualization wish={wish} size="large" />
        <div className={styles.noteCaption}>
          <span className={styles.noteTitle}>{wish.title}</span>
          {onPinToggle && (
            <button
              className={`${styles.pinButton} ${wish.pinned ? styles.pinButtonActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onPinToggle(wish.id);
              }}
              aria-label={wish.pinned ? 'Unpin' : 'Pin'}
            >
              {wish.pinned ? <PinIconSolid /> : <PinIcon />}
            </button>
          )}
        </div>
      </PaperCard>

      {/* The same opening as the landing page: straight into the living scene */}
      {spaceRect && (
        <WishSpace
          wish={wish}
          originRect={spaceRect}
          instantAlive
          onClose={() => setSpaceRect(null)}
          onDetails={onDetails ? () => {
            setSpaceRect(null);
            onDetails(wish);
          } : undefined}
        />
      )}
    </>
  );
}
