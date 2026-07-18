'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from './LanguageProvider';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase/client';
import { syncAllData } from '../lib/syncData';

export default function Nav() {
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const syncedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.session);
      const userId = data.session?.user.id;
      if (userId && syncedSessionRef.current !== userId) {
        syncedSessionRef.current = userId;
        void syncAllData();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      const userId = session?.user.id;
      if (userId && syncedSessionRef.current !== userId) {
        syncedSessionRef.current = userId;
        void syncAllData();
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setShowUserMenu(false);
  }

  // Nav destinations. Wish Gallery carries a short label for ≤560px so the
  // whole row still fits at 375px (CSS swaps full ⇄ short via .nav-label-*).
  const links: { href: string; label: string; short?: string }[] = [
    { href: '/try', label: t('nav_create', lang) },
    { href: '/daily', label: t('nav_daily', lang) },
    { href: '/wishes', label: t('nav_wishes', lang), short: lang === 'zh' ? '画廊' : 'Gallery' },
  ];

  return (
    <div className="card nav-bar">
      <div className="container nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-dot" />
          <span>
            <span className="nav-wordmark">{lang === 'zh' ? 'Wishflow · 愿航' : 'Wishflow'}</span>
            <span className="nav-subtitle">
              {lang === 'zh' ? '一生级愿望导航' : 'Life-long Wish Navigation'}
            </span>
          </span>
        </Link>
        <div className="nav-actions">
          {/* The three destinations. This track may scroll on very narrow
              screens; auth + language toggle stay pinned and always visible. */}
          <div className="nav-links">
            {links.map(({ href, label, short }) => (
              <Link
                key={href}
                href={href}
                className={`nav-pill${pathname === href ? ' active' : ''}`}
              >
                {short ? (
                  <>
                    <span className="nav-label-full">{label}</span>
                    <span className="nav-label-short">{short}</span>
                  </>
                ) : (
                  label
                )}
              </Link>
            ))}
          </div>

          {/* User menu - combines 我/登录/退出 */}
          <div ref={menuRef} className="nav-slot">
            {signedIn ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="nav-pill outline"
                >
                  {t('nav_me', lang)}
                </button>
                {showUserMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    minWidth: 140,
                    overflow: 'hidden',
                    zIndex: 100,
                  }}>
                    <Link
                      href="/me"
                      onClick={() => setShowUserMenu(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: 'var(--ink)',
                        textDecoration: 'none',
                        fontSize: 14,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {lang === 'zh' ? '个人设置' : 'Settings'}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text)',
                        fontSize: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {t('nav_signout', lang)}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link className="nav-pill outline" href="/login">
                {t('nav_signin', lang)}
              </Link>
            )}
          </div>

          {/* Language toggle — inlined so it shares the .nav-pill footprint;
              still just swaps zh ⇄ en like the standalone component did. */}
          <button
            type="button"
            className="nav-pill ghost nav-slot"
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            aria-label="Toggle language"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </div>
    </div>
  );
}
