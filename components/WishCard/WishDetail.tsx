/**
 * WishDetail Component / 愿力卡详情组件
 * Modal view for detailed wish information and connection history
 * 愿望详情弹窗，显示完整信息和连接历史
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { LocalWish, LocalConnection, wishStore } from '@/lib/localStore';
import { fileToCompressedDataUrl } from '@/lib/imageUpload';
import { useLanguage } from '@/components/LanguageProvider';
import { useWishConnections } from '@/hooks/useLocalConnections';
import { CONNECTION_LEVELS, getWishWhisper, getMinimumConnection, DOMAINS, STAGES } from '@/lib/constants';
import { ConnectionIcon, PinIcon, PinIconSolid } from '../Icons';
import ConnectionButtons from './ConnectionButtons';
import WishVisualization from './WishVisualization';
import WishSpace from '@/components/WishSpace';
import styles from './WishCard.module.css';

type WishDetailProps = {
  wish: LocalWish;
  onClose: () => void;
  onConnect?: (wishId: string, level: string, note?: string) => void;
  onPinToggle?: (wishId: string) => void;
  onWishChange?: () => void;
};

// Format date for display
function formatDate(dateString: string, language: string): string {
  const date = new Date(dateString);
  if (language === 'zh') {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Translate domain name based on language
function getDomainLabel(domain: string | null, language: string): string {
  if (!domain) return '';
  if (language === 'en') {
    const domainEntry = DOMAINS.find(d => d.label === domain);
    return domainEntry?.labelEn || domain;
  }
  return domain;
}

// Translate stage based on language
function getStageLabel(stage: string | null, language: string): string {
  if (!stage) return '';
  if (language === 'en') {
    const stageEntry = STAGES.find(s => s.label === stage);
    return stageEntry?.labelEn || stage;
  }
  return stage;
}

export default function WishDetail({ wish, onClose, onConnect, onPinToggle, onWishChange }: WishDetailProps) {
  const { language } = useLanguage();
  const { connections, loading } = useWishConnections(wish.id);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState('');

  // User-uploaded drawing. Local state gives instant feedback in the modal;
  // wishStore.update persists it and onWishChange refreshes the parent list.
  const [userImage, setUserImage] = useState<string | null>(wish.user_image ?? null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meditation space, opened by tapping the artwork; rect = zoom origin
  const [spaceRect, setSpaceRect] = useState<DOMRect | null>(null);

  // Reset when a different wish is opened in the same modal instance
  useEffect(() => {
    setUserImage(wish.user_image ?? null);
    setImageError('');
  }, [wish.id, wish.user_image]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setImageBusy(true);
    setImageError('');
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      wishStore.update(wish.id, { user_image: dataUrl });
      setUserImage(dataUrl);
      onWishChange?.();
    } catch {
      setImageError(language === 'zh' ? '这张图没读出来，换一张试试。' : "Couldn't read that image — try another.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleImageRevert = () => {
    wishStore.update(wish.id, { user_image: null });
    setUserImage(null);
    setImageError('');
    onWishChange?.();
  };

  const whisper = getWishWhisper(wish, language as 'en' | 'zh');
  const minConnection = getMinimumConnection(wish.domain, language as 'en' | 'zh');

  // Close on escape key — unless the meditation space is open on top;
  // its own Escape handler closes just the space, the modal stays.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !spaceRect) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, spaceRect]);

  const handleConnect = async () => {
    if (!selectedLevel || !onConnect) return;
    setConnecting(true);
    try {
      await onConnect(wish.id, selectedLevel, note || undefined);
      setSelectedLevel(null);
      setNote('');
      setConnectionNotice(language === 'zh' ? '记录完成。不断线。' : 'Saved. Still connected.');
    } finally {
      setConnecting(false);
    }
  };

  const getLevelInfo = (levelId: string) => {
    return CONNECTION_LEVELS.find(l => l.id === levelId) || CONNECTION_LEVELS[0];
  };

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <h2 className={styles.detailTitle}>{wish.title}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Visualization — the user's own drawing takes priority when present.
            Tapping it zooms into the meditation space. */}
        <div style={{ marginBottom: 4, display: 'grid', placeItems: 'center' }}>
          <WishVisualization
            wish={{ ...wish, user_image: userImage }}
            size="large"
            onClick={(e) => setSpaceRect(e.currentTarget.getBoundingClientRect())}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text)', opacity: 0.6, textAlign: 'center', margin: '0 0 12px' }}>
          {language === 'zh' ? '点一下画，走进去待一会儿。' : 'Tap the drawing to step inside for a while.'}
        </p>

        {/* Draw-it-yourself: upload your own line, in the same visual language */}
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className={styles.actionBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={imageBusy}
              style={{ flex: 'none', padding: '8px 14px', fontSize: 12 }}
            >
              {imageBusy
                ? (language === 'zh' ? '放进来…' : 'Adding…')
                : userImage
                  ? (language === 'zh' ? '换一张我画的' : 'Replace my drawing')
                  : (language === 'zh' ? '上传我画的图' : 'Upload my drawing')}
            </button>
            {userImage && (
              <button
                className={styles.actionBtn}
                onClick={handleImageRevert}
                disabled={imageBusy}
                style={{ flex: 'none', padding: '8px 14px', fontSize: 12 }}
              >
                {language === 'zh' ? '还原成生成的图' : 'Back to generated'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text)', opacity: 0.7, textAlign: 'center', margin: 0 }}>
            {imageError
              ? imageError
              : userImage
                ? (language === 'zh' ? '这是你亲手画的。' : "This one's yours.")
                : (language === 'zh' ? '也可以亲手画一张，塞进来。' : 'Or draw one yourself and drop it in.')}
          </p>
        </div>

        {/* Description (if available) */}
        {wish.description && (
          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>
              {language === 'zh' ? '愿望描述' : 'Description'}
            </div>
            <div className={styles.sectionContent}>{wish.description}</div>
          </div>
        )}

        {/* End Scene */}
        {wish.end_scene && (
          <div className={styles.detailSection}>
            <div className={styles.sectionLabel}>
              {language === 'zh' ? '终局画面' : 'End Scene'}
            </div>
            <div className={styles.sectionContent}>{wish.end_scene}</div>
          </div>
        )}

        {/* Metadata row */}
        <div className={styles.badges}>
          {wish.domain && (
            <span className={`${styles.badge} ${styles.badgeDomain}`}>
              {getDomainLabel(wish.domain, language)}
            </span>
          )}
          {wish.stage && (
            <span className={styles.badge}>
              {language === 'zh' ? '阶段：' : 'Stage: '}{getStageLabel(wish.stage, language)}
            </span>
          )}
          {wish.will_source && (
            <span className={styles.badge}>
              {language === 'zh' ? '愿力源：' : 'Source: '}{wish.will_source}
            </span>
          )}
        </div>

        {/* Whisper */}
        <p className={styles.whisper}>{whisper}</p>

        {/* Connection buttons */}
        {onConnect && (
          <>
            {connectionNotice && (
              <p className={styles.whisper}>{connectionNotice}</p>
            )}

            <ConnectionButtons
              selectedLevel={selectedLevel}
              onSelect={setSelectedLevel}
              disabled={connecting}
            />
            
            {selectedLevel && (
              <>
                <textarea
                  className={styles.noteInput}
                  placeholder={language === 'zh' 
                    ? `今天的连接记录（可选）...\n最低连接：${minConnection}` 
                    : `Connection note (optional)...\nMinimum: ${minConnection}`
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => setSelectedLevel(null)}
                    disabled={connecting}
                  >
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting 
                      ? (language === 'zh' ? '记录中...' : 'Saving...') 
                      : (language === 'zh' ? '记录连接' : 'Record')
                    }
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Connection History */}
        <div className={styles.connectionHistory}>
          <h4 className={styles.historyTitle}>
            {language === 'zh' ? '连接历史' : 'Connection History'}
          </h4>
          
          {loading ? (
            <p style={{ color: 'var(--text)', fontSize: '13px' }}>
              {language === 'zh' ? '加载中...' : 'Loading...'}
            </p>
          ) : connections.length === 0 ? (
            <p style={{ color: 'var(--text)', fontSize: '13px' }}>
              {language === 'zh' ? '还没有连接记录' : 'No connections yet'}
            </p>
          ) : (
            <div className={styles.historyList}>
              {connections.slice(0, 5).map((conn) => {
                const levelInfo = getLevelInfo(conn.level);
                return (
                  <div key={conn.id} className={styles.historyItem}>
                    <div className={styles.historyLevel}>
                      <ConnectionIcon levelId={levelInfo.id} size={14} />
                      <span>{language === 'zh' ? levelInfo.label : levelInfo.labelEn}</span>
                    </div>
                    <span className={styles.historyDate}>
                      {formatDate(conn.connected_at, language)}
                    </span>
                    {conn.note && (
                      <p className={styles.historyNote}>{conn.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={styles.actions}>
          {onPinToggle && (
            <button
              className={styles.actionBtn}
              onClick={() => onPinToggle(wish.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
            >
              {wish.pinned ? <PinIconSolid size={14} /> : <PinIcon size={14} />}
              {wish.pinned 
                ? (language === 'zh' ? '取消置顶' : 'Unpin') 
                : (language === 'zh' ? '置顶' : 'Pin')
              }
            </button>
          )}
          <button 
            className={styles.actionBtn}
            style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
          >
            {language === 'zh' ? '分享愿望' : 'Share'}
          </button>
        </div>
      </div>

      {/* Meditation space — portals to <body>, floats above the modal */}
      {spaceRect && (
        <WishSpace
          wish={{ ...wish, user_image: userImage }}
          originRect={spaceRect}
          onClose={() => setSpaceRect(null)}
        />
      )}
    </div>
  );
}
