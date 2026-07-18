'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from './LanguageProvider';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase/client';
import { syncAllData } from '../lib/syncData';

export default function Nav() {
  const { lang } = useLanguage();
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

  return (
    <div className="card" style={{ position: 'sticky', top: 0, zIndex: 10, borderRadius: 0, boxShadow: 'none', borderBottom: '1px solid var(--border)' }}>
      <div
        className="container"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}
      >
        <Link href="/" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--wish)' }} />
          <div>
            <div style={{ fontWeight: 700 }}>{lang === 'zh' ? 'Wishflow · 愿航' : 'Wishflow'}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {lang === 'zh' ? '一生级愿望导航' : 'Life-long Wish Navigation'}
            </div>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Create → the generator. First item: making a wish starts here. */}
          <Link
            href="/try"
            style={{
              color: pathname === '/try' ? 'var(--wish)' : 'var(--ink)',
              fontWeight: pathname === '/try' ? 600 : 400,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 10,
              background: pathname === '/try' ? 'rgba(155, 143, 196, 0.12)' : 'transparent',
              transition: 'all 160ms ease',
            }}
          >
            {t('nav_create', lang)}
          </Link>
          <Link
            href="/daily"
            style={{
              color: pathname === '/daily' ? 'var(--wish)' : 'var(--ink)',
              fontWeight: pathname === '/daily' ? 600 : 400,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 10,
              background: pathname === '/daily' ? 'rgba(155, 143, 196, 0.12)' : 'transparent',
              transition: 'all 160ms ease',
            }}
          >
            {t('nav_daily', lang)}
          </Link>
          {/* Wish Gallery → the collection, now home to the galaxy/river views too. */}
          <Link
            href="/wishes"
            style={{
              color: pathname === '/wishes' ? 'var(--wish)' : 'var(--ink)',
              fontWeight: pathname === '/wishes' ? 600 : 400,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 10,
              background: pathname === '/wishes' ? 'rgba(155, 143, 196, 0.12)' : 'transparent',
              transition: 'all 160ms ease',
            }}
          >
            {t('nav_wishes', lang)}
          </Link>
          
          {/* User menu - combines 我/登录/退出 */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            {signedIn ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 14,
                  }}
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
              <Link className="btn" href="/login" style={{ padding: '6px 12px', fontSize: 14 }}>
                {t('nav_signin', lang)}
              </Link>
            )}
          </div>
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
