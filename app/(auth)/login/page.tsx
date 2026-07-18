/**
 * Login Page / 登录页
 * User authentication with email/password and Google OAuth
 * 用户登录 - 支持邮箱密码和 Google OAuth
 */
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useLanguage } from '../../../components/LanguageProvider';
import { t } from '../../../lib/i18n';
import { WOBBLY_FRAME } from '../../../components/wobblyFrame';

export default function LoginPage() {
  const { lang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithPassword() {
    setLoading(true);
    setStatus('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setStatus(error.message);
    } else {
      window.location.href = '/wishes';
    }
  }

  async function signUp() {
    setLoading(true);
    setStatus('');
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setStatus(error.message);
    } else {
      setStatus(lang === 'en' ? 'Account created. Check your email to confirm.' : '账号已创建，请查收邮件确认。');
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setStatus('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/overview` }
    });
    setLoading(false);
    if (error) {
      setStatus(error.message);
    }
  }

  // Dashed "note paper" field — the same line the /try sheet speaks
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1.6px dashed var(--border)',
    background: 'rgba(255,255,255,0.5)',
    fontSize: 15.5,
    marginTop: 8,
    fontFamily: 'inherit',
    color: 'var(--ink)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--wish-ink)',
    letterSpacing: '0.2px',
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 'calc(100dvh - 72px)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(24px, 5vw, 56px) 20px',
        overflow: 'hidden',
      }}
    >
      {/* Ambient scenery — a paper boat bobbing on two drifting dashed
          water-lines, and a single slow star. Pure decoration, no pointer. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* a lone star, drifting up near the top */}
        <svg viewBox="0 0 40 40" className="login-star" style={{ position: 'absolute', top: '11%', right: 'clamp(8%, 16vw, 22%)', width: 'clamp(26px, 4vw, 36px)' }}>
          <path d="M20 5 L23 17 L35 20 L23 23 L20 35 L17 23 L5 20 L17 17 Z"
            fill="none" stroke="#B5A8D0" strokeWidth="1.6" strokeLinejoin="round" opacity="0.7" />
        </svg>

        {/* two water-lines flowing along the very bottom */}
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 170 }}>
          <g fill="none" strokeLinecap="round">
            <path className="login-river" d="M -20 92 Q 200 44 460 86 Q 720 128 980 80 Q 1100 56 1220 84"
              stroke="#9C8CC2" strokeWidth="2.2" strokeDasharray="24 16" opacity="0.42" />
            <path className="login-river2" d="M -20 150 Q 220 100 480 146 Q 740 190 1000 138 Q 1110 112 1220 140"
              stroke="#B5A8D0" strokeWidth="1.8" strokeDasharray="17 13" opacity="0.34" />
          </g>
        </svg>

        {/* the paper boat, riding the swell */}
        <svg viewBox="-20 -16 40 34" style={{ position: 'absolute', bottom: 44, left: '50%', width: 'clamp(52px, 8vw, 72px)', transform: 'translateX(-50%)', overflow: 'visible' }}>
          <g className="login-boat">
            <path d="M -13 0 L -8 7 Q 0 10 8 7 L 13 0 Z M -13 0 L -3 0 L 0 -8 L 3 0 L 13 0"
              fill="#FAF9F7" stroke="#5B4B84" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M -9 11 L -3 11 M 2 12.5 L 9 12.5" fill="none" stroke="#9C8CC2" strokeWidth="0.9" opacity="0.6" />
          </g>
        </svg>

        <style jsx>{`
          .login-star { animation: loginStarFloat 7s ease-in-out infinite; }
          @keyframes loginStarFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          .login-river { animation: loginRiverFlow 18s linear infinite; }
          .login-river2 { animation: loginRiverFlow 24s linear infinite; }
          @keyframes loginRiverFlow {
            to { stroke-dashoffset: -80; }
          }
          .login-boat {
            animation: loginBoatBob 4.8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }
          @keyframes loginBoatBob {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50% { transform: translateY(-3px) rotate(2.2deg); }
          }
        `}</style>
      </div>

      {/* Auth card — a centered sheet of paper */}
      <div
        style={{
          ...WOBBLY_FRAME,
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 460,
          margin: 'auto',
          padding: 'clamp(24px, 4vw, 44px)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-serif), ui-serif, serif', fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: 600, letterSpacing: '0.4px', margin: 0, color: 'var(--ink)' }}>
          {t('auth_title', lang)}
        </h1>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14.5, lineHeight: 1.7, color: 'var(--wish-ink)' }}>
          {t('auth_subtitle', lang)}
        </p>

        <div style={{ marginTop: 26, display: 'grid', gap: 16 }}>
          <label style={labelStyle}>
            {t('auth_email', lang)}
            <input
              style={fieldStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </label>

          <label style={labelStyle}>
            {t('auth_password', lang)}
            <input
              style={fieldStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={lang === 'en' ? 'At least 8 characters' : '至少 8 位'}
            />
          </label>

          <button
            className="btn solid"
            onClick={signInWithPassword}
            disabled={loading}
            style={{ width: '100%', padding: '13px 20px', fontSize: 15, borderRadius: 999, marginTop: 2 }}
          >
            {t('auth_login', lang)}
          </button>

          <button
            className="btn"
            onClick={signUp}
            disabled={loading}
            style={{ width: '100%', padding: '13px 20px', fontSize: 15, borderRadius: 999 }}
          >
            {t('auth_signup', lang)}
          </button>

          {/* soft divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)', fontSize: 12, margin: '2px 0' }}>
            <span style={{ flex: 1, borderTop: '1.4px dashed var(--border)' }} />
            {lang === 'en' ? 'or' : '或'}
            <span style={{ flex: 1, borderTop: '1.4px dashed var(--border)' }} />
          </div>

          <button
            className="btn"
            onClick={signInWithGoogle}
            disabled={loading}
            style={{ width: '100%', padding: '13px 20px', fontSize: 15, borderRadius: 999 }}
          >
            {t('auth_google', lang)}
          </button>

          {status && (
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--wish-ink)', textAlign: 'center' }}>{status}</div>
          )}

          <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13, lineHeight: 1.7, textAlign: 'center' }}>
            {t('auth_hint', lang)}
          </p>

          <p className="muted" style={{ marginTop: 0, marginBottom: 0, fontSize: 12, lineHeight: 1.7, textAlign: 'center' }}>
            {lang === 'en' ? 'By signing up you agree to our ' : '注册即表示你同意'}
            <a href="/terms" style={{ color: 'var(--wish)', textDecoration: 'underline' }}>
              {lang === 'en' ? 'Terms' : '服务条款'}
            </a>
            {lang === 'en' ? ' and ' : '与'}
            <a href="/privacy" style={{ color: 'var(--wish)', textDecoration: 'underline' }}>
              {lang === 'en' ? 'Privacy Policy' : '隐私政策'}
            </a>
            {lang === 'en' ? '.' : '。'}
          </p>
        </div>
      </div>
    </div>
  );
}
