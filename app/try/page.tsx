/**
 * Try Page / 体验页
 * Free trial for wish visualization - saves to localStorage without login
 * 无需登录即可体验愿望可视化 - 自动保存到本地
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { WOBBLY_FRAME } from '@/components/wobblyFrame';
import { useLanguage } from '@/components/LanguageProvider';
import { logger } from '@/lib/logger';
import { MoonNew, MoonCrescent, MoonFull } from '@/components/Icons';
import { wishStore } from '@/lib/localStore';
import { supabase } from '@/lib/supabase/client';
import { TimeScope, TargetTime, WishDomain, WishMood } from '@/lib/types';
import { ClassificationResult } from '@/lib/ai';
import { DOMAINS } from '@/lib/constants';
import { apiUrl } from '@/lib/apiBase';

type Step = 'input' | 'generating' | 'preview' | 'saved';

// Generation progress steps
type GenerationStep = 'analyzing' | 'classifying' | 'generating' | 'done';

// Helper to translate domain to English
function getDomainLabel(domain: string, language: string): string {
  if (language === 'en') {
    const domainEntry = DOMAINS.find(d => d.label === domain);
    return domainEntry?.labelEn || domain;
  }
  return domain;
}

// Extended classification result with SVG
type ClassificationWithSVG = ClassificationResult & {
  svg?: string;
  svgFallback?: boolean;
  quotaExceeded?: boolean;
  quota?: { used: number; limit: number };
};

export default function TryPage() {
  const { language } = useLanguage();
  
  // Form state
  const [description, setDescription] = useState('');
  const [timeScope, setTimeScope] = useState<TimeScope>('long');
  const [targetTime, setTargetTime] = useState<TargetTime>('years');
  
  // AI classification result
  const [classification, setClassification] = useState<ClassificationWithSVG | null>(null);
  
  // UI state
  const [step, setStep] = useState<Step>('input');
  const [generationStep, setGenerationStep] = useState<GenerationStep>('analyzing');
  const [generatedSVG, setGeneratedSVG] = useState<string | null>(null);
  const [svgFallback, setSvgFallback] = useState(false);
  const [savedWishId, setSavedWishId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);

  // The gallery's quick-create box hands its text over via ?prefill=
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('prefill');
    if (p) setDescription(p);
  }, []);

  // Call AI classification + SVG generation API
  const classifyAndGenerateSVG = useCallback(async (desc: string): Promise<ClassificationWithSVG> => {
    try {
      // Send the auth token when logged in so the server counts this against the
      // account's daily quota (3/day) instead of the anonymous IP quota (1/day).
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(apiUrl('/api/classify'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: desc,
          generateSVG: true,  // Request SVG generation
          language,           // so title & keywords match the UI language
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        logger.error('API Error:', data);
        throw new Error(data.error || 'Classification failed');
      }
      
      return await response.json();
    } catch (err) {
      logger.error('Classification error:', err);
      
      // Show user-friendly error message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('credit balance') || errorMessage.includes('502')) {
        logger.debug('AI service temporarily unavailable, using fallback');
      }
      
      // Fallback: return default classification without SVG
      return {
        domain: '生活' as WishDomain,
        keywords: language === 'zh' ? ['愿望'] : ['a wish'],
        mood: '平静' as WishMood,
        title: desc.slice(0, 40) + (desc.length > 40 ? '…' : ''),
        svgFallback: true,
      };
    }
  }, [language]);

  // Generate visualization with animation
  const handleGenerate = useCallback(async () => {
    if (!description.trim() || description.trim().length < 5) {
      setError(language === 'zh' ? '请至少输入5个字描述你的愿望' : 'Please enter at least 5 characters');
      return;
    }
    
    setError(null);
    setStep('generating');
    setGenerationStep('analyzing');
    
    // Simulate initial analysis progress
    await new Promise(resolve => setTimeout(resolve, 600));
    setGenerationStep('classifying');
    
    // Call AI classification + SVG generation
    const result = await classifyAndGenerateSVG(description);
    setClassification(result);

    // Gently explain when the daily AI quota is spent (the wish still gets a
    // hand-drawn template, so nothing is blocked).
    if (result.quotaExceeded) {
      const lim = result.quota?.limit ?? 1;
      setQuotaNotice(
        language === 'zh'
          ? `今天的 ${lim} 张 AI 手绘用完了，这张先用生成图占位。${lim === 1 ? '登录后每天有 3 张。' : '明天再来看看。'}`
          : `You've used today's ${lim} AI drawing${lim > 1 ? 's' : ''} — this one uses a generated placeholder. ${lim === 1 ? 'Sign in for 3 a day.' : 'Come back tomorrow.'}`
      );
    } else {
      setQuotaNotice(null);
    }
    
    await new Promise(resolve => setTimeout(resolve, 400));
    setGenerationStep('generating');
    
    // Set SVG from API response
    if (result.svg) {
      setGeneratedSVG(result.svg);
      setSvgFallback(result.svgFallback || false);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setGenerationStep('done');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    setStep('preview');
  }, [description, classifyAndGenerateSVG, language]);

  // Save wish to localStorage
  const handleSave = useCallback(() => {
    if (!classification) return;
    
    const seed = description.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const newWish = wishStore.add({
      title: classification.title,
      description: description.trim(),
      domain: classification.domain,
      stage: null, // Can be added later
      will_source: null,
      end_scene: null,
      time_scope: timeScope,
      target_time: targetTime,
      svg_pattern: classification.domain,
      svg_data: generatedSVG || null,  // Save AI-generated SVG
      keywords: classification.keywords,
      mood: classification.mood,
      line_seed: String(seed),
      pinned: false,
      last_connected_at: null,
      last_level: null,
    });
    
    setSavedWishId(newWish.id);
    setStep('saved');
  }, [description, classification, generatedSVG, timeScope, targetTime]);

  // Reset to create another
  const handleReset = useCallback(() => {
    setDescription('');
    setTimeScope('long');
    setTargetTime('years');
    setClassification(null);
    setGeneratedSVG(null);
    setSvgFallback(false);
    setStep('input');
    setSavedWishId(null);
    setError(null);
    setQuotaNotice(null);
  }, []);

  return (
    <div className="container" style={{ paddingTop: 48, maxWidth: 920, position: 'relative' }}>
      {/* Ambient scenery — a swirl-drawn sun, a drifting cloud, and a river
          flowing along the bottom of the page. Pure decoration, zero pointer. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: '-24px -10vw 0', pointerEvents: 'none', zIndex: 0 }}>
        {/* swirl sun (虎皮卷纹理 — light travels round the spiral) */}
        <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: 10, right: '4%', width: 'clamp(110px, 14vw, 185px)' }}>
          <g fill="none" stroke="#B5A8D0" strokeLinecap="round">
            <path
              className="try-swirl"
              d="M 100 100 m -3 0 a 3 3 0 1 1 7 0 a 8 8 0 1 1 -17 0 a 14 14 0 1 1 29 0 a 21 21 0 1 1 -43 0 a 28 28 0 1 1 57 0 a 36 36 0 1 1 -72 0"
              strokeWidth="2"
              strokeDasharray="30 14"
            />
            <path
              d="M 100 46 L 100 32 M 140 60 L 150 50 M 154 100 L 168 100 M 140 140 L 150 150 M 60 140 L 50 150 M 46 100 L 32 100 M 60 60 L 50 50 M 100 154 L 100 166"
              strokeWidth="1.8"
              opacity="0.75"
            />
          </g>
        </svg>
        {/* a slow cloud */}
        <svg viewBox="0 0 140 44" className="try-cloud" style={{ position: 'absolute', top: 96, left: '5%', width: 'clamp(80px, 9vw, 130px)' }}>
          <path d="M 18 32 Q 22 18 38 20 Q 44 8 60 12 Q 76 6 84 18 Q 100 16 104 26 Q 112 32 104 36 L 24 36 Q 14 36 18 32 Z"
            fill="none" stroke="#B5A8D0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
        {/* the river along the bottom of the viewport — big rolling waves,
            a proper paper boat riding them */}
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', height: 190 }}>
          <g fill="none" strokeLinecap="round">
            <path className="try-river" d="M -20 76 Q 160 8 360 70 Q 560 132 760 58 Q 960 -6 1220 66"
              stroke="#9C8CC2" strokeWidth="2.2" strokeDasharray="24 16" opacity="0.5" />
            <path className="try-river2" d="M -20 150 Q 210 88 470 144 Q 730 196 990 132 Q 1110 104 1220 138"
              stroke="#B5A8D0" strokeWidth="1.8" strokeDasharray="17 13" opacity="0.4" />
            {/* the paper boat, several times bigger, riding the swell */}
            <g transform="translate(860 96) scale(3.1)">
              <g className="try-boat">
                <path d="M -13 0 L -8 7 Q 0 10 8 7 L 13 0 Z M -13 0 L -3 0 L 0 -8 L 3 0 L 13 0"
                  fill="#FAF9F7" stroke="#5B4B84" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M -9 11 L -3 11 M 2 12.5 L 9 12.5" stroke="#9C8CC2" strokeWidth="0.9" opacity="0.6" />
              </g>
            </g>
          </g>
        </svg>
        <style jsx>{`
          .try-swirl {
            animation: trySwirlFlow 14s linear infinite;
          }
          @keyframes trySwirlFlow {
            to { stroke-dashoffset: -88; }
          }
          .try-cloud {
            animation: tryCloudFloat 9s ease-in-out infinite;
          }
          @keyframes tryCloudFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          .try-river { animation: tryRiverFlow 16s linear infinite; }
          .try-river2 { animation: tryRiverFlow 22s linear infinite; }
          @keyframes tryRiverFlow {
            to { stroke-dashoffset: -80; }
          }
          .try-boat {
            animation: tryBoatBob 4.8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }
          @keyframes tryBoatBob {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50% { transform: translateY(-3px) rotate(2.2deg); }
          }
        `}</style>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
        <h1 className="h1" style={{ margin: 0 }}>
          {language === 'zh' ? '生成愿望意象图' : 'Generate Wish Visualization'}
        </h1>
        <p className="muted" style={{ marginTop: 12, maxWidth: 600, margin: '12px auto 0' }}>
          {language === 'zh' 
            ? '描述你的愿望，AI 会为你生成专属的流动图案。无需注册，自动保存到本地。' 
            : 'Describe your wish and AI will generate a unique flowing visualization. No sign-up needed.'}
        </p>
      </div>

      {/* Step 1: Input Form — a sheet of paper, not a form card */}
      {step === 'input' && (
        <div style={{ ...WOBBLY_FRAME, padding: 'clamp(18px, 3.5vw, 40px)' }}>
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Description */}
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 15 }}>
                {language === 'zh' ? '请描述你的愿望 *' : 'Describe your wish *'}
              </label>
              <textarea
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1.6px dashed var(--border)',
                  background: 'rgba(255,255,255,0.5)',
                  fontSize: 16.5,
                  minHeight: 140,
                  resize: 'vertical',
                  lineHeight: 1.8,
                  fontFamily: 'inherit',
                }}
                placeholder={language === 'zh' 
                  ? '例如：我想带爸爸妈妈去一次邮轮旅行，让他们在海上放松休息，一家人留下美好的回忆...' 
                  : 'e.g., I want to take my parents on a cruise trip, let them relax on the sea...'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {error && (
                <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 8 }}>{error}</p>
              )}
            </div>

            {/* Time Options — stacks on narrow screens */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              {/* Time Scope */}
              <div>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  {language === 'zh' ? '这是什么类型的愿望？' : 'What type of wish is this?'}
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setTimeScope('short')}
                    className={timeScope === 'short' ? 'btn primary' : 'btn'}
                    style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                  >
                    {language === 'zh' ? '短期愿望' : 'Short-term'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeScope('long')}
                    className={timeScope === 'long' ? 'btn primary' : 'btn'}
                    style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                  >
                    {language === 'zh' ? '长期愿望' : 'Long-term'}
                  </button>
                </div>
              </div>

              {/* Target Time */}
              <div>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  {language === 'zh' ? '你希望什么时候实现？' : 'When do you want to achieve it?'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTargetTime('weeks')}
                    className={targetTime === 'weeks' ? 'btn primary' : 'btn'}
                    style={{ flex: 1, padding: '10px 8px', fontSize: 12 }}
                  >
                    {language === 'zh' ? '几周内' : 'Weeks'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetTime('months')}
                    className={targetTime === 'months' ? 'btn primary' : 'btn'}
                    style={{ flex: 1, padding: '10px 8px', fontSize: 12 }}
                  >
                    {language === 'zh' ? '几个月' : 'Months'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetTime('years')}
                    className={targetTime === 'years' ? 'btn primary' : 'btn'}
                    style={{ flex: 1, padding: '10px 8px', fontSize: 12 }}
                  >
                    {language === 'zh' ? '几年内' : 'Years'}
                  </button>
                </div>
              </div>
            </div>

            <button 
              className="btn dark" 
              onClick={handleGenerate}
              disabled={!description.trim() || description.trim().length < 5}
              style={{ 
                padding: '14px 24px',
                fontSize: 16,
                marginTop: 8,
                background: 'var(--wish)',
                borderColor: 'var(--wish)',
                color: '#fff',
                opacity: (!description.trim() || description.trim().length < 5) ? 0.5 : 1,
                cursor: (!description.trim() || description.trim().length < 5) ? 'not-allowed' : 'pointer'
              }}
            >
              {language === 'zh' ? '生成我的愿望图' : 'Generate My Wish Image'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Generating Animation — a little boat rocking on a self-drawing wave */}
      {step === 'generating' && (
        <div style={{ ...WOBBLY_FRAME, padding: 'clamp(32px, 5vw, 56px)', textAlign: 'center' }}>
          <div style={{ width: 200, height: 150, margin: '0 auto 20px', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 160 120" style={{ width: 180, height: 135, overflow: 'visible' }}
                 fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              {/* twinkling star */}
              <circle cx="124" cy="28" r="9" stroke="var(--wish)" strokeWidth="2.4" className="gen-twinkle" />
              {/* the little boat, gently rocking */}
              <g className="gen-boat">
                <path d="M52 78 Q 80 94 108 78" />
                <path d="M80 78 L 80 30" />
                <path d="M80 34 C 104 46 106 66 83 76" />
                <path d="M80 30 L 94 27 L 80 24" strokeWidth="2" />
              </g>
              {/* the wave, drawing itself over and over */}
              <path d="M14 96 Q 34 88 54 96 T 94 96 T 146 96" stroke="var(--wish)" strokeWidth="2.6"
                    strokeDasharray="180" className="gen-wave" />
              <path d="M20 106 Q 40 100 60 106 T 100 106 T 150 106" stroke="var(--wish)" strokeWidth="2"
                    opacity="0.4" strokeDasharray="180" className="gen-wave2" />
            </svg>
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>
            {language === 'zh' ? '正在为你的愿望，慢慢画出形状…' : 'Giving your wish a shape…'}
          </h3>
          
          {/* Progress steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ 
                width: 20, height: 20, borderRadius: '50%', 
                background: 'var(--wish)',
                display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12,
              }}>
                {generationStep !== 'analyzing' ? '✓' : '●'}
              </span>
              <span style={{ 
                color: generationStep === 'analyzing' ? 'var(--ink)' : 'var(--text)',
                fontWeight: generationStep === 'analyzing' ? 600 : 400,
              }}>
                {language === 'zh' ? '分析愿望内容' : 'Analyzing your wish'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ 
                width: 20, height: 20, borderRadius: '50%', 
                background: generationStep === 'classifying' ? 'var(--wish)' : (['generating', 'done'].includes(generationStep) ? 'var(--wish)' : 'var(--border)'),
                display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12,
              }}>
                {['generating', 'done'].includes(generationStep) ? '✓' : (generationStep === 'classifying' ? '●' : '○')}
              </span>
              <span style={{ 
                color: generationStep === 'classifying' ? 'var(--ink)' : 'var(--text)',
                fontWeight: generationStep === 'classifying' ? 600 : 400,
              }}>
                {language === 'zh' ? '识别领域和关键词' : 'Identifying domain & keywords'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ 
                width: 20, height: 20, borderRadius: '50%', 
                background: generationStep === 'generating' ? 'var(--wish)' : (generationStep === 'done' ? 'var(--wish)' : 'var(--border)'),
                display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12,
              }}>
                {generationStep === 'done' ? '✓' : (generationStep === 'generating' ? '●' : '○')}
              </span>
              <span style={{ 
                color: generationStep === 'generating' ? 'var(--ink)' : 'var(--text)',
                fontWeight: generationStep === 'generating' ? 600 : 400,
              }}>
                {language === 'zh' ? '生成流动图案' : 'Generating flowing pattern'}
              </span>
            </div>
          </div>
          
          <style jsx>{`
            .gen-boat {
              transform-box: fill-box;
              transform-origin: 80px 88px;
              animation: gen-rock 3.2s ease-in-out infinite;
            }
            @keyframes gen-rock {
              0%, 100% { transform: rotate(-4deg); }
              50% { transform: rotate(4deg); }
            }
            .gen-wave {
              animation: gen-draw 2.4s ease-in-out infinite;
            }
            .gen-wave2 {
              animation: gen-draw 2.4s ease-in-out infinite;
              animation-delay: 0.4s;
            }
            @keyframes gen-draw {
              0% { stroke-dashoffset: 180; }
              55%, 100% { stroke-dashoffset: 0; }
            }
            .gen-twinkle {
              transform-box: fill-box;
              transform-origin: center;
              animation: gen-tw 2.6s ease-in-out infinite;
            }
            @keyframes gen-tw {
              0%, 100% { opacity: 0.35; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && classification && (
        <div>
          {/* Quiet back link — a secondary step, not a peer of Save */}
          <button
            onClick={() => setStep('input')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13, padding: '4px 0', marginBottom: 8 }}
          >
            {language === 'zh' ? '← 返回编辑' : '← Back to edit'}
          </button>

          {/* Visualization — the drawing on a big framed sheet, held in a
              breathing halo of wish-light */}
          <div
            style={{
              ...WOBBLY_FRAME,
              position: 'relative',
              padding: 'clamp(28px, 5vw, 60px)',
              marginBottom: 24,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            <div className="try-halo" aria-hidden="true" />
            <style jsx>{`
              .try-halo {
                position: absolute;
                inset: 6%;
                background: radial-gradient(circle at 50% 46%, rgba(145, 127, 185, 0.14), transparent 62%);
                filter: blur(16px);
                animation: try-halo-breathe 8s ease-in-out infinite;
                pointer-events: none;
              }
              @keyframes try-halo-breathe {
                0%, 100% { opacity: 0.55; transform: scale(1); }
                50% { opacity: 0.9; transform: scale(1.05); }
              }
            `}</style>
            {generatedSVG ? (
              <div
                dangerouslySetInnerHTML={{ __html: generatedSVG }}
                style={{
                  width: '100%',
                  maxWidth: 760,
                  display: 'flex',
                  justifyContent: 'center',
                  position: 'relative',
                }}
                className="wish-svg-container"
              />
            ) : (
              <div style={{ 
                width: 400, 
                height: 220, 
                background: 'var(--border)', 
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text)'
              }}>
                {language === 'zh' ? '图像生成中...' : 'Generating...'}
              </div>
            )}
            {quotaNotice && (
              <p style={{ fontSize: 12, marginTop: 8, textAlign: 'center', color: 'var(--wish)', maxWidth: 360, marginInline: 'auto', lineHeight: 1.6 }}>
                {quotaNotice}
              </p>
            )}
            {svgFallback && !quotaNotice && (
              <p className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                {language === 'zh' ? '从我们的手绘本里为你挑了一张 · 可点击 Regenerate 再试' : 'Drawn from our sketchbook · tap Regenerate to try again'}
              </p>
            )}
            {!svgFallback && generatedSVG && (
              <p className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                {language === 'zh' ? 'AI 生成线条图' : 'AI-generated line drawing'}
              </p>
            )}
          </div>

          {/* Info */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-serif), ui-serif, serif', fontSize: 26, fontWeight: 600, letterSpacing: '0.3px', margin: '0 0 12px', color: 'var(--ink)' }}>
              {classification.title}
            </h2>
            <p className="muted" style={{ marginBottom: 16, lineHeight: 1.8, maxWidth: 500, margin: '0 auto 16px', fontSize: 14 }}>
              {description}
            </p>

            {/* Tags - show only domain and one keyword */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              <span className="badge" style={{ background: 'rgba(107, 92, 142, 0.15)', color: 'var(--wish)', fontWeight: 600 }}>
                {getDomainLabel(classification.domain, language)}
              </span>
              {classification.keywords.length > 0 && (
                <span className="badge" style={{ background: 'rgba(230, 225, 240, 0.5)' }}>
                  {classification.keywords[0]}
                </span>
              )}
            </div>

            {/* Connection levels info */}
            <div style={{ 
              padding: 20, 
              background: 'rgba(230, 225, 240, 0.2)', 
              borderRadius: 16,
              textAlign: 'left', 
              maxWidth: 420, 
              margin: '0 auto' 
            }}>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.9 }}>
                <div style={{ marginBottom: 8 }}>
                  <b><MoonNew size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{language === 'zh' ? '最低连接（2分钟）' : 'Minimum (2 min)'}：</b>
                  {language === 'zh' ? '看一眼意象图' : 'Look at the image'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <b><MoonCrescent size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{language === 'zh' ? '正常连接（15分钟）' : 'Normal (15 min)'}：</b>
                  {language === 'zh' ? '写一句话' : 'Write a sentence'}
                </div>
                <div>
                  <b><MoonFull size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{language === 'zh' ? '深度连接（60分钟）' : 'Deep (60 min)'}：</b>
                  {language === 'zh' ? '推进现实行动' : 'Take real action'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions — two clear choices: try again, or keep it */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleGenerate}>
              {language === 'zh' ? '重新生成一张' : 'Regenerate'}
            </button>
            <button className="btn solid" onClick={handleSave}>
              {language === 'zh' ? '保存愿望' : 'Save Wish'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Saved */}
      {step === 'saved' && (
        <div style={{ ...WOBBLY_FRAME, padding: 'clamp(28px, 4vw, 48px)', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px' }}>
            <circle cx="24" cy="24" r="16" stroke="#6B5C8E" strokeWidth="2.5" fill="none" opacity="0.3" />
            <circle cx="24" cy="24" r="10" fill="#6B5C8E" />
            <path d="M18 24 L22 28 L30 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px' }}>
            {language === 'zh' ? '愿望已保存!' : 'Wish Saved!'}
          </h2>
          <p className="muted" style={{ marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            {language === 'zh' 
              ? '你的愿望已保存到本地，并已经进入愿力卡库。现在可以去查看、连接，或继续创建下一个。' 
              : 'Your wish is saved locally and now appears in Wish Gallery. You can view it, connect with it, or create another.'}
          </p>

          {/* One primary next step + one secondary; the rest are quiet links */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleReset}>
              {language === 'zh' ? '再创建一个' : 'Create Another'}
            </button>
            <Link href="/wishes" className="btn solid">
              {language === 'zh' ? '查看愿望画廊' : 'View Wish Gallery'}
            </Link>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 22, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/daily" style={{ color: 'var(--wish)', fontSize: 13, textDecoration: 'none' }}>
              {language === 'zh' ? '今日连接' : 'Today'}
            </Link>
            <Link href="/overview" style={{ color: 'var(--wish)', fontSize: 13, textDecoration: 'none' }}>
              {language === 'zh' ? '愿力地图' : 'Wish Map'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
