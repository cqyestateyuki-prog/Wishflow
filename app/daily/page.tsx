/**
 * Daily Page / 今日面板
 * Daily dashboard with energy state and wish connections
 * 今日面板 - 能量状态选择和愿望连接
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import LoginPrompt from '@/components/LoginPrompt';
import WishCard from '@/components/WishCard';
import WishDetail from '@/components/WishCard/WishDetail';
import { useLocalWishes } from '@/hooks/useLocalWishes';
import { useLocalConnections } from '@/hooks/useLocalConnections';
import { useLanguage } from '@/components/LanguageProvider';
import { LocalWish } from '@/lib/localStore';
import { ENERGY_STATES, CONNECTION_LEVELS, DOMAINS } from '@/lib/constants';
import { ConnectionIcon, EnergyIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase/client';
import { clearSampleData } from '@/lib/localStore';

// Translate domain name based on language
function getDomainLabel(domain: string | null, language: string): string {
  if (!domain) return '';
  if (language === 'en') {
    const domainEntry = DOMAINS.find(d => d.label === domain);
    return domainEntry?.labelEn || domain;
  }
  return domain;
}

export default function DailyPage() {
  const { language } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const { wishes, loading, recordConnection, togglePin, getDailyRecommended, reload } = useLocalWishes();
  const { getTodayConnections } = useLocalConnections();
  
  const [energyState, setEnergyState] = useState<string>('normal');
  const [detailWish, setDetailWish] = useState<LocalWish | null>(null);
  const [connectedToday, setConnectedToday] = useState<Set<string>>(new Set());

  // Check auth state and clear sample data on login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Clear sample data when user is logged in
        clearSampleData();
        reload(); // Refresh wish list after clearing sample data
      }
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Clear sample data when user logs in
        clearSampleData();
        reload(); // Refresh wish list after clearing sample data
      }
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  // Get recommended wishes for today
  const recommendedWishes = getDailyRecommended(3);
  const todayConnections = getTodayConnections();

  // Get suggested connection level based on energy
  const getSuggestedLevel = () => {
    switch (energyState) {
      case 'tired': return 'minimum';
      case 'normal': return 'normal';
      case 'energetic': return 'deep';
      default: return 'minimum';
    }
  };

  // Handle connection
  const handleConnect = useCallback((wishId: string, level: string, note?: string) => {
    recordConnection(wishId, level, note);
    setConnectedToday(prev => new Set([...prev, wishId]));
  }, [recordConnection]);

  // Handle pin toggle
  const handlePinToggle = useCallback((wishId: string) => {
    togglePin(wishId);
  }, [togglePin]);

  const suggestedLevel = getSuggestedLevel();
  const suggestedLevelInfo = CONNECTION_LEVELS.find(l => l.id === suggestedLevel);

  // Loading state (checking auth)
  if (isLoggedIn === null) {
    return (
      <PageShell titleKey="daily_title">
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      </PageShell>
    );
  }

  // Logged out visitors without local wishes see a demo. After /try saves a
  // local wish, they can use the real daily flow immediately.
  if (!isLoggedIn && !loading && wishes.length === 0) {
    return (
      <PageShell titleKey="daily_title">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="h1" style={{ margin: 0 }}>
            {language === 'zh' ? '今日' : 'Today'}
          </h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {language === 'zh' 
              ? '登录后记录你的每日状态和愿望连接。' 
              : 'Sign in to track your daily state and wish connections.'
            }
          </p>
        </div>

        {/* Mock Energy State Selection - clickable to show login prompt */}
        <div 
          className="card" 
          style={{ padding: 20, marginBottom: 20, opacity: 0.75, cursor: 'pointer' }}
          onClick={() => setShowLoginPrompt(true)}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
            {language === 'zh' ? '今天的你，状态如何？' : 'How are you feeling today?'}
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ENERGY_STATES.map((state, index) => (
              <button
                key={state.id}
                className={index === 1 ? 'btn primary' : 'btn'}
                style={{ 
                  padding: '12px 20px',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  pointerEvents: 'none',
                }}
              >
                <EnergyIcon stateId={state.id} size={20} />
                <span>{language === 'zh' ? state.label : state.labelEn}</span>
              </button>
            ))}
          </div>
          
          {/* Mock Suggestion */}
          <div style={{ 
            marginTop: 16, 
            padding: '12px 16px', 
            background: 'rgba(107, 92, 142, 0.08)', 
            borderRadius: 14,
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--wish)', fontWeight: 600 }}>
              {language === 'zh' ? '建议' : 'Suggestion'}:
            </span>{' '}
            <span style={{ color: 'var(--text)' }}>
              {language === 'zh' 
                ? '状态还可以，可以尝试正常连接。写一句话，或做一个小动作。' 
                : 'You\'re doing okay. Try a normal connection. Write a note or take a small action.'
              }
            </span>
          </div>
        </div>

        {/* Today's count — one quiet line, not a card of its own */}
        <p
          className="muted"
          style={{ fontSize: 12, textAlign: 'right', margin: '0 0 14px', opacity: 0.8, cursor: 'pointer' }}
          onClick={() => setShowLoginPrompt(true)}
        >
          {language === 'zh' ? '今日连接' : 'Today'}: <b style={{ color: 'var(--wish)' }}>0</b>
          {' · '}
          {language === 'zh' ? '建议：正常连接' : 'suggested: normal'}
        </p>

        {/* Mock Wish Cards - clickable */}
        <div style={{ marginBottom: 20, opacity: 0.75 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>
            {language === 'zh' ? '今日推荐' : 'Today\'s Recommendations'}
          </h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {[
              { title: language === 'zh' ? '做出自己的产品并上线' : 'Build and Launch My Own Product', domain: language === 'zh' ? '创造' : 'Creation' },
              { title: language === 'zh' ? '找到人生伴侣' : 'Find My Life Partner', domain: language === 'zh' ? '爱' : 'Love' },
              { title: language === 'zh' ? '全家人去一次邮轮旅行' : 'Family Cruise Trip Together', domain: language === 'zh' ? '家人' : 'Family' },
            ].map((wish, i) => (
              <div 
                key={i} 
                className="card" 
                style={{ padding: 16, cursor: 'pointer' }}
                onClick={() => setShowLoginPrompt(true)}
              >
                <div style={{ marginBottom: 12 }}>
                  <b style={{ fontSize: 14 }}>{wish.title}</b>
                  <div style={{ fontSize: 11, color: 'var(--text)', opacity: 0.7, marginTop: 4 }}>
                    {getDomainLabel(wish.domain, language)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Login Prompt Modal */}
        {showLoginPrompt && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 24,
            }}
            onClick={() => setShowLoginPrompt(false)}
          >
            <div 
              className="card"
              style={{
                maxWidth: 420,
                width: '100%',
                padding: '32px 28px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.98)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ 
                width: 64, 
                height: 64, 
                margin: '0 auto 20px',
                borderRadius: '50%',
                background: 'rgba(155, 143, 196, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="14" cy="14" r="6" stroke="#6B5C8E" strokeWidth="2" fill="none" />
                  <path d="M14 3 L14 9" stroke="#6B5C8E" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M14 19 L14 25" stroke="#6B5C8E" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 14 L9 14" stroke="#6B5C8E" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M19 14 L25 14" stroke="#6B5C8E" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, color: 'var(--ink)' }}>
                {language === 'zh' ? '登录以使用完整功能' : 'Sign in to access full features'}
              </h2>
              <p className="muted" style={{ margin: '0 0 24px', fontSize: 14 }}>
                {language === 'zh' 
                  ? '创建账号后，你可以记录每日状态、管理愿望，并追踪你的连接历史。' 
                  : 'Create an account to track daily states, manage wishes, and follow your connection history.'
                }
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button 
                  className="btn"
                  onClick={() => setShowLoginPrompt(false)}
                  style={{ padding: '10px 20px' }}
                >
                  {language === 'zh' ? '稍后' : 'Later'}
                </button>
                <Link href="/login">
                  <button className="btn-primary-large" style={{ padding: '10px 24px' }}>
                    {language === 'zh' ? '登录 / 注册' : 'Sign In / Sign Up'}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell titleKey="daily_title">
      {isLoggedIn === false && (
        <div style={{ marginBottom: 16 }}>
          <LoginPrompt
            variant="inline"
            message={language === 'zh'
              ? '今日连接会先保存在本地。登录后可以同步连接记录。'
              : 'Today’s connections are saved locally first. Sign in to sync them.'
            }
          />
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="h1" style={{ margin: 0 }}>
          {language === 'zh' ? '今日' : 'Today'}
        </h1>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {language === 'zh' 
            ? '选择今天的状态，温柔地和愿望保持连接。' 
            : 'Choose your state today, gently stay connected with your wishes.'
          }
        </p>
      </div>

      {/* Energy State Selection */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
          {language === 'zh' ? '今天的你，状态如何？' : 'How are you feeling today?'}
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ENERGY_STATES.map((state) => (
            <button
              key={state.id}
              onClick={() => setEnergyState(state.id)}
              className={energyState === state.id ? 'btn primary' : 'btn'}
              style={{ 
                padding: '12px 20px',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <EnergyIcon stateId={state.id} size={20} />
              <span>{language === 'zh' ? state.label : state.labelEn}</span>
            </button>
          ))}
        </div>
        
        {/* Suggestion based on energy */}
        <div style={{ 
          marginTop: 16, 
          padding: '12px 16px', 
          background: 'rgba(107, 92, 142, 0.08)', 
          borderRadius: 14,
          fontSize: 13,
        }}>
          <span style={{ color: 'var(--wish)', fontWeight: 600 }}>
            {language === 'zh' ? '建议' : 'Suggestion'}:
          </span>{' '}
          <span style={{ color: 'var(--text)' }}>
            {energyState === 'tired' && (language === 'zh' 
              ? '今天状态不佳，做最低连接就很棒了。看一眼愿望图，说一句"我还在"。' 
              : 'Low energy today. Minimum connection is great. Just look at your wish and say "I\'m still here".'
            )}
            {energyState === 'normal' && (language === 'zh' 
              ? '状态还可以，可以尝试正常连接。写一句话，或做一个小动作。' 
              : 'Feeling okay. Try a normal connection. Write a sentence or take a small action.'
            )}
            {energyState === 'energetic' && (language === 'zh' 
              ? '精力充沛！可以尝试深度连接，推进一次现实行动。' 
              : 'Full of energy! Try a deep connection. Make real progress.'
            )}
          </span>
        </div>
      </div>

      {/* Today's count — one quiet line tucked to the side, not its own card */}
      <p className="muted" style={{ fontSize: 12, textAlign: 'right', margin: '0 0 14px', opacity: 0.85, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
        {language === 'zh' ? '今日连接' : 'Today'}:
        <b style={{ color: 'var(--wish)' }}>{todayConnections.length}</b>
        {' · '}
        {language === 'zh' ? '建议' : 'suggested'}:
        {suggestedLevelInfo && <ConnectionIcon levelId={suggestedLevelInfo.id} size={13} />}
        {language === 'zh' ? suggestedLevelInfo?.label : suggestedLevelInfo?.labelEn}
      </p>

      {/* Loading state */}
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      ) : recommendedWishes.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          {/* Empty state icon */}
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px' }}>
            <path d="M8 32 Q16 26 24 32 T40 32 T56 32" stroke="#B5A8D0" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="6 4" />
            <path d="M8 42 Q16 36 24 42 T40 42 T56 42" stroke="#8E7BB0" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="6 4" />
            <circle cx="32" cy="20" r="6" stroke="#6B5C8E" strokeWidth="2.5" fill="none" />
          </svg>
          <h3 style={{ marginBottom: 8 }}>{language === 'zh' ? '还没有愿望' : 'No wishes yet'}</h3>
          <p className="muted">
            {language === 'zh' 
              ? '去创建你的第一个愿望吧' 
              : 'Create your first wish'
            }
          </p>
          <a href="/wishes" className="btn primary" style={{ marginTop: 16 }}>
            {language === 'zh' ? '创建愿望' : 'Create Wish'}
          </a>
        </div>
      ) : (
        <>
          {/* Recommended Wishes */}
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>
            {language === 'zh' ? '今日适合的愿望' : 'Today\'s Recommended Wishes'}
          </h3>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
            {language === 'zh' 
              ? '点击愿望卡片，选择适合今天的连接方式' 
              : 'Click a wish card to choose your connection level'
            }
          </p>

          {/* Cards keep a book-page width and center — never a full-bleed
              stretch with the art lost in one corner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 500px))', justifyContent: 'center', gap: 24 }}>
            {recommendedWishes.map((wish) => {
              const isConnectedToday = connectedToday.has(wish.id) ||
                todayConnections.some(c => c.wish_id === wish.id);

              return (
                <div key={wish.id} style={{ position: 'relative' }}>
                  {isConnectedToday && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: 'rgba(107, 92, 142, 0.9)',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      zIndex: 10,
                    }}>
                      {language === 'zh' ? '✓ 已连接' : '✓ Connected'}
                    </div>
                  )}
                  <WishCard
                    wish={wish}
                    showConnectionButtons={true}
                    showWhisper={true}
                    onConnect={handleConnect}
                    onPinToggle={handlePinToggle}
                    onClick={() => setDetailWish(wish)}
                  />
                </div>
              );
            })}
          </div>

          {/* Gentle reminder */}
          <div style={{ 
            marginTop: 24, 
            padding: 20, 
            background: 'rgba(230, 225, 240, 0.25)',
            borderRadius: 18,
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--wish)', fontSize: 14, margin: 0 }}>
              {language === 'zh' 
                ? '你只需要保持与愿望的连接，然后慢慢推进。' 
                : 'A glance is still a connection.'
              }
            </p>
          </div>
        </>
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
