/**
 * Wishes Page / 愿望管理页 · 愿力卡库
 * Create, view, and manage all wishes in a gallery
 * 创建、查看和管理所有愿望 - 画廊模式
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import LoginPrompt from '@/components/LoginPrompt';
import WishCard from '@/components/WishCard';
import WishNote from '@/components/WishCard/WishNote';
import WishDetail from '@/components/WishCard/WishDetail';
import { StarMap, RiverMap } from '@/components/WishMap';
import { StarIcon, WaveIcon } from '@/components/Icons';
import { useLocalWishes } from '@/hooks/useLocalWishes';
import { useLanguage } from '@/components/LanguageProvider';
import { LocalWish, clearSampleData } from '@/lib/localStore';
import { DOMAINS, CONNECTION_LEVELS } from '@/lib/constants';
import { supabase } from '@/lib/supabase/client';
import { WOBBLY_FRAME } from '@/components/wobblyFrame';
import cardStyles from '@/components/WishCard/WishCard.module.css';
import mapStyles from '@/components/WishMap/WishMap.module.css';

type SortOption = 'recent' | 'created' | 'pinned';
// Board = the pinned-paper gallery; Galaxy/River = the former Wish Map views,
// now folded in here so the whole collection lives on one page.
type ViewMode = 'board' | 'galaxy' | 'river';

// Constellation positions (% of the gallery space) for small counts —
// wishes arrange like stars: alone at the center, a pair facing each other,
// a pyramid, a five-pointed star, a dipper… 10+ falls back to the grid.
const CONSTELLATIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[31, 44], [69, 58]],
  3: [[50, 22], [28, 70], [72, 70]],
  4: [[29, 25], [71, 21], [25, 72], [71, 76]],
  5: [[50, 15], [23, 41], [77, 41], [33, 80], [67, 80]],
  6: [[50, 15], [79, 33], [79, 68], [50, 86], [21, 68], [21, 33]],
  7: [[14, 26], [34, 18], [15, 60], [36, 54], [55, 32], [72, 52], [88, 30]],
  8: [[20, 22], [46, 16], [72, 22], [88, 40], [13, 56], [38, 68], [64, 62], [86, 80]],
  9: [[18, 20], [50, 16], [82, 20], [16, 53], [50, 49], [84, 53], [22, 84], [54, 86], [84, 82]],
};

const CONST_HEIGHTS: Record<number, number> = {
  1: 560, 2: 660, 3: 860, 4: 920, 5: 980, 6: 1000, 7: 940, 8: 1040, 9: 1150,
};

export default function WishesPage() {
  const { language } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const {
    wishes,
    loading,
    togglePin,
    recordConnection,
    deleteWish,
    filterWishes,
    getSorted,
    reload
  } = useLocalWishes();

  const [detailWish, setDetailWish] = useState<LocalWish | null>(null);
  // Quick-create box at the top — hands the text to /try for generation
  const [quickWish, setQuickWish] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('pinned');
  const [domainFilter, setDomainFilter] = useState('');
  // Board / Galaxy / River — the collection can be read as a pinned board or
  // as one of the two Wish Map canvases.
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  // Check auth state and clear sample data on login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        clearSampleData();
        reload();
      }
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearSampleData();
        reload();
      }
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  // Filter and sort wishes
  const filteredWishes = filterWishes({
    search: searchQuery,
    domain: domainFilter || undefined,
  });
  const sortedWishes = getSorted(sortBy).filter(w => 
    filteredWishes.some(fw => fw.id === w.id)
  );

  // Handle connection
  const handleConnect = useCallback((wishId: string, level: string, note?: string) => {
    recordConnection(wishId, level, note);
  }, [recordConnection]);

  // Handle pin toggle
  const handlePinToggle = useCallback((wishId: string) => {
    togglePin(wishId);
  }, [togglePin]);

  // Count stats
  const pinnedCount = wishes.filter(w => w.pinned).length;
  const totalCount = wishes.length;

  // Loading state (checking auth)
  if (isLoggedIn === null) {
    return (
      <PageShell titleKey="wishes_title">
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell titleKey="wishes_title">
      {isLoggedIn === false && (
        <div style={{ marginBottom: 16 }}>
          <LoginPrompt
            variant="inline"
            message={language === 'zh'
              ? '这些愿望安全地保存在这台设备上。想跨设备继续，可以'
              : 'These wishes are kept safely on this device. To carry them across devices,'
            }
          />
        </div>
      )}

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>
            {language === 'zh' ? '愿力卡库' : 'Wish Gallery'}
          </h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {language === 'zh'
              ? `${totalCount} 个愿望 · ${pinnedCount} 个置顶`
              : `${totalCount} wishes · ${pinnedCount} pinned`
            }
          </p>
        </div>
      </div>

      {/* Quick create — the same hand-drawn sheet as /try, right at the top:
          write a wish here and it sails over to the generator */}
      <div style={{ ...WOBBLY_FRAME, padding: 'clamp(14px, 2.4vw, 26px)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <textarea
            value={quickWish}
            onChange={(e) => setQuickWish(e.target.value)}
            rows={2}
            placeholder={language === 'zh'
              ? '写下一个愿望，让它慢慢成形…'
              : 'Write a wish and let it slowly take shape…'}
            style={{
              flex: '1 1 320px',
              padding: '12px 14px',
              borderRadius: 14,
              border: '1.6px dashed var(--border)',
              background: 'rgba(255,255,255,0.5)',
              fontSize: 15,
              lineHeight: 1.7,
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
          <Link
            href={quickWish.trim().length >= 5 ? `/try?prefill=${encodeURIComponent(quickWish.trim())}` : '/try'}
            className="btn solid"
            style={{ alignSelf: 'center', whiteSpace: 'nowrap', padding: '12px 22px' }}
          >
            {language === 'zh' ? '生成愿望图' : 'Generate wish image'}
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder={language === 'zh' ? '搜索愿望...' : 'Search wishes...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            flex: 1,
            minWidth: 200,
          }}
        />
        
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          style={{
            padding: '10px 32px 10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1L5 5L9 1\' stroke=\'%236B5C8E\' stroke-width=\'1.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="">{language === 'zh' ? '全部领域' : 'All domains'}</option>
          {DOMAINS.map(d => (
            <option key={d.id} value={d.label}>
              {language === 'zh' ? d.label : d.labelEn}
            </option>
          ))}
        </select>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          style={{
            padding: '10px 32px 10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1L5 5L9 1\' stroke=\'%236B5C8E\' stroke-width=\'1.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="pinned">{language === 'zh' ? '置顶优先' : 'Pinned first'}</option>
          <option value="recent">{language === 'zh' ? '最近连接' : 'Recent'}</option>
          <option value="created">{language === 'zh' ? '创建时间' : 'Created'}</option>
        </select>

        {/* View toggle — read the same wishes as a pinned board, a galaxy,
            or a river. Styled to match the selects in this row. */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { mode: 'board', label: language === 'zh' ? '画板' : 'Board', icon: null },
            { mode: 'galaxy', label: language === 'zh' ? '星系' : 'Galaxy', icon: <StarIcon size={13} /> },
            { mode: 'river', label: language === 'zh' ? '河流' : 'River', icon: <WaveIcon size={13} /> },
          ] as const).map(({ mode, label, icon }) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'rgba(107,92,142,0.7)' : 'var(--border)'}`,
                  background: active ? 'rgba(155,143,196,0.15)' : 'rgba(255,255,255,0.6)',
                  color: active ? 'var(--wish)' : 'var(--ink)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 160ms ease',
                }}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wish Gallery — board / galaxy / river all read the same sortedWishes */}
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      ) : viewMode === 'galaxy' ? (
        // Galaxy — the former Wish Map star canvas, full-bleed
        <div className={mapStyles.mapFullBleed}>
          <StarMap
            wishes={sortedWishes}
            selectedWishId={null}
            onWishSelect={() => {}}
            onWishClick={(w) => setDetailWish(w)}
          />
        </div>
      ) : viewMode === 'river' ? (
        // River — the former Wish Map river canvas, full-bleed
        <div className={mapStyles.mapFullBleed}>
          <RiverMap
            wishes={sortedWishes}
            selectedWishId={null}
            onWishSelect={() => {}}
            onWishClick={(w) => setDetailWish(w)}
          />
        </div>
      ) : sortedWishes.length === 0 ? (
        <div className={cardStyles.emptyState}>
          <div className={cardStyles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="16" stroke="#B5A8D0" strokeWidth="2" fill="none" opacity="0.5" />
              <circle cx="24" cy="24" r="10" stroke="#6B5C8E" strokeWidth="2.5" fill="none" />
              <circle cx="24" cy="24" r="3" fill="#6B5C8E" />
            </svg>
          </div>
          <h3 className={cardStyles.emptyTitle}>
            {searchQuery || domainFilter 
              ? (language === 'zh' ? '没有找到匹配的愿望' : 'No matching wishes')
              : (language === 'zh' ? '还没有愿望' : 'No wishes yet')
            }
          </h3>
          <p className={cardStyles.emptyDesc}>
            {searchQuery || domainFilter 
              ? (language === 'zh' ? '尝试调整搜索条件' : 'Try adjusting your search')
              : (
                <>
                  {language === 'zh' ? (
                    <>还可以先在 <Link href="/try" style={{ color: 'var(--wish)' }}>体验页</Link> 生成一张愿望图，或点击「新建愿望」。</>
                  ) : (
                    <>Start at <Link href="/try" style={{ color: 'var(--wish)' }}>/try</Link> to generate a wish map, or click &quot;New Wish&quot;.</>
                  )}
                </>
              )
            }
          </p>
        </div>
      ) : (
        // The gallery: the same paper world as the landing scene — sheets
        // pinned over a quietly drifting river
        <div className={cardStyles.gallerySpace}>
          <svg className={cardStyles.galleryRivers} viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" strokeLinecap="round">
              <path className={cardStyles.riverLine} d="M -20 210 Q 240 180 480 212 Q 720 244 960 208 Q 1200 176 1460 210"
                stroke="#9C8CC2" strokeWidth="1.8" strokeDasharray="22 15" opacity="0.5" />
              <path className={cardStyles.riverLine} d="M -20 470 Q 280 440 560 472 Q 840 504 1120 468 Q 1300 448 1460 470"
                stroke="#B5A8D0" strokeWidth="1.5" strokeDasharray="16 13" opacity="0.42" />
              <path className={cardStyles.riverLine} d="M -20 730 Q 260 700 520 732 Q 800 766 1080 728 Q 1290 704 1460 730"
                stroke="#B5A8D0" strokeWidth="1.4" strokeDasharray="26 18" opacity="0.32" />
              {/* birds + a low dashed sun, same sky as the landing */}
              <path d="M 1150 90 q 9 -9 18 0 q 9 -9 18 0 M 1230 120 q 7 -7 14 0" stroke="#B5A8D0" strokeWidth="1.5" opacity="0.6" />
              <circle cx="180" cy="105" r="42" stroke="#B5A8D0" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.55" />
            </g>
          </svg>
          {(() => {
            const pattern = CONSTELLATIONS[sortedWishes.length];
            if (pattern) {
              return (
                <div
                  className={cardStyles.constellation}
                  style={{ ['--constH' as string]: `${CONST_HEIGHTS[sortedWishes.length]}px` }}
                >
                  {sortedWishes.map((wish, i) => {
                    // tiny seeded jitter so no two constellations feel stamped
                    const seed = Array.from(wish.id).reduce((s, ch) => s + ch.charCodeAt(0), 0);
                    const jx = ((seed % 5) - 2) * 0.8;
                    const jy = ((seed % 7) - 3) * 0.7;
                    const [cx, cy] = pattern[i];
                    return (
                      <div
                        key={wish.id}
                        className={cardStyles.constNote}
                        style={{
                          ['--cx' as string]: `${cx + jx}%`,
                          ['--cy' as string]: `${cy + jy}%`,
                        }}
                      >
                        <WishNote
                          wish={wish}
                          onPinToggle={handlePinToggle}
                          onDetails={(w) => setDetailWish(w)}
                          onWishChange={reload}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            }
            return (
              <div className={cardStyles.board}>
                {sortedWishes.map((wish) => (
                  <div key={wish.id} className={cardStyles.boardNote}>
                    <WishNote
                      wish={wish}
                      onPinToggle={handlePinToggle}
                      onDetails={(w) => setDetailWish(w)}
                      onWishChange={reload}
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Wish Detail Modal */}
      {detailWish && (
        <WishDetail
          wish={detailWish}
          onClose={() => setDetailWish(null)}
          onConnect={handleConnect}
          onPinToggle={handlePinToggle}
          onWishChange={reload}
        />
      )}
    </PageShell>
  );
}
