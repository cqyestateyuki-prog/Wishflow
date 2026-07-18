/**
 * AI Service Layer / AI 服务层
 * Provides Claude API integration for wish classification, keyword extraction, and SVG generation
 * 提供 Claude API 集成，用于愿望分类、关键词提取和 SVG 生成
 */

import Anthropic from '@anthropic-ai/sdk';
import { WishDomain, WishMood } from './types';
import { logger } from '@/lib/logger';

// Classification result type
export type ClassificationResult = {
  domain: WishDomain;
  keywords: string[];
  mood: WishMood;
  title: string; // Auto-generated short title
};

// SVG generation result type
export type SVGGenerationResult = {
  svg: string;
  success: boolean;
  error?: string;
  sceneSpec?: WishSceneSpec;
  validationIssues?: string[];
};

export type WishSceneSpec = {
  subject: string;
  supportingElements: string[];
  composition: string;
  motionElements: string[];
  avoid: string[];
  style: string;
};

export type SVGValidationResult = {
  ok: boolean;
  svg?: string;
  issues: string[];
};

// Error type for AI operations
export class AIError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AIError';
  }
}

// Create Anthropic client (server-side only)
function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIError('ANTHROPIC_API_KEY is not set', 'MISSING_API_KEY');
  }
  return new Anthropic({ apiKey });
}

export type UiLanguage = 'en' | 'zh';

// Classification prompt — domain/mood stay as the internal Chinese enums,
// but title + keywords follow the user's UI language so an English UI never
// shows Chinese chrome (and vice versa).
function buildClassificationPrompt(description: string, language: UiLanguage): string {
  const isEn = language === 'en';
  const outLang = isEn ? 'English' : 'Chinese (中文)';
  const titleSpec = isEn ? '3 to 7 words' : '10-15 个字';
  return `You are a wish-analysis assistant. Analyze the wish below and return JSON only.

Wish:
${description}

Return exactly this JSON, no other text:
{
  "domain": one of these EXACT Chinese values: 家人, 事业, 钱, 健康, 创造, 生活, 爱,
  "keywords": [2 or 3 short, concrete, visual imagery words in ${outLang}],
  "mood": one of these EXACT Chinese values: 温暖, 激励, 平静, 期待, 自由,
  "title": a short ${outLang} title (${titleSpec}) capturing the heart of the wish
}

Rules:
- "domain" MUST be exactly one of the 7 Chinese values above — this is an internal category, keep it Chinese.
- "mood" MUST be exactly one of the 5 Chinese values above — internal category, keep it Chinese.
- "keywords" and "title" MUST be written in ${outLang} (the user's interface language), regardless of what language the wish itself is written in.
- keywords should be concrete and image-friendly (things you could draw), not abstract.`;
}

/**
 * Classify a wish description using Claude API
 * @param description - The wish description to classify
 * @param language - The user's UI language (drives title & keyword language)
 * @returns Classification result with domain, keywords, mood, and title
 */
export async function classifyWish(description: string, language: UiLanguage = 'en'): Promise<ClassificationResult> {
  if (!description || description.trim().length < 5) {
    throw new AIError('Description is too short', 'INVALID_INPUT');
  }

  const prompt = buildClassificationPrompt(description, language);

  // Same provider preference as drawing: Gemini free tier first, then Anthropic.
  const provider = aiProvider();
  if (!provider) {
    throw new AIError('No AI provider configured', 'MISSING_API_KEY');
  }

  try {
    let raw: string;
    if (provider === 'gemini') {
      raw = await requestGeminiText(prompt, process.env.GEMINI_API_KEY!, 1200);
    } else {
      const client = createClient();
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      raw = extractTextContent(response);
    }

    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AIError('Could not parse JSON from response', 'PARSE_ERROR');
    }

    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

    // Validate domain
    const validDomains: WishDomain[] = ['家人', '事业', '钱', '健康', '创造', '生活', '爱'];
    if (!validDomains.includes(result.domain)) {
      result.domain = '生活'; // Default fallback
    }

    // Validate mood
    const validMoods: WishMood[] = ['温暖', '激励', '平静', '期待', '自由'];
    if (!validMoods.includes(result.mood)) {
      result.mood = '平静'; // Default fallback
    }

    // Ensure keywords is an array
    if (!Array.isArray(result.keywords)) {
      result.keywords = [];
    }

    // Ensure title exists
    if (!result.title || result.title.trim().length === 0) {
      result.title = description.slice(0, 20) + (description.length > 20 ? '...' : '');
    }

    return result;
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new AIError('Failed to parse AI response', 'PARSE_ERROR');
    }
    throw new AIError(
      error instanceof Error ? error.message : 'Unknown error during classification',
      'API_ERROR'
    );
  }
}

/**
 * Fallback classification using keyword matching (no API needed)
 * @param description - The wish description to classify
 * @returns Classification result based on keyword matching
 */
export function classifyWishLocal(description: string, language: UiLanguage = 'en'): ClassificationResult {
  const text = description.toLowerCase();
  
  // Domain keywords mapping
  const domainKeywords: Record<WishDomain, string[]> = {
    '家人': ['爸', '妈', '父', '母', '家人', '家庭', '孩子', '子女', '父母', '亲人', '兄弟', '姐妹'],
    '事业': ['工作', '职业', '事业', '公司', '职位', '升职', '创业', '项目', '技能', '能力'],
    '钱': ['钱', '收入', '财富', '存款', '投资', '理财', '赚钱', '薪水', '资产', '被动收入', '交易', '出金', '盈利', '利润'],
    '健康': ['健康', '身体', '运动', '锻炼', '减肥', '睡眠', '情绪', '心理', '医疗', '养生'],
    '创造': ['创作', '创造', '写作', '小说', '艺术', '音乐', '画', '设计', '作品', '表达'],
    '生活': ['生活', '日常', '习惯', '环境', '城市', '房子', '旅行', '体验', '品质'],
    '爱': ['爱', '爱情', '恋爱', '伴侣', '婚姻', '感情', '关系', '约会', '心动'],
  };

  // Mood keywords mapping
  const moodKeywords: Record<WishMood, string[]> = {
    '温暖': ['温暖', '陪伴', '家人', '关心', '照顾', '幸福', '美好'],
    '激励': ['努力', '奋斗', '挑战', '突破', '成功', '目标', '成就'],
    '平静': ['平静', '安稳', '稳定', '放松', '安心', '舒适', '从容'],
    '期待': ['期待', '希望', '梦想', '未来', '可能', '憧憬', '向往'],
    '自由': ['自由', '独立', '自主', '选择', '探索', '冒险', '无拘'],
  };

  // Find best matching domain
  let bestDomain: WishDomain = '生活';
  let maxDomainScore = 0;
  for (const [domain, keywords] of Object.entries(domainKeywords) as [WishDomain, string[]][]) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > maxDomainScore) {
      maxDomainScore = score;
      bestDomain = domain;
    }
  }

  // Find best matching mood
  let bestMood: WishMood = '平静';
  let maxMoodScore = 0;
  for (const [mood, keywords] of Object.entries(moodKeywords) as [WishMood, string[]][]) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > maxMoodScore) {
      maxMoodScore = score;
      bestMood = mood;
    }
  }

  // Extract simple keywords (nouns that appear in the description)
  const keywords: string[] = [];
  for (const kws of Object.values(domainKeywords)) {
    for (const kw of kws) {
      if (text.includes(kw) && !keywords.includes(kw) && keywords.length < 3) {
        keywords.push(kw);
      }
    }
  }

  // Generate title (first 15 chars or up to first punctuation)
  const titleEnd = Math.min(
    description.length,
    15,
    ...[description.indexOf('，'), description.indexOf('。'), description.indexOf('！')]
      .filter(i => i > 0)
  );
  const title = description.slice(0, titleEnd).trim() + (titleEnd < description.length ? '' : '');

  // Keep chrome (keywords/title) in the user's UI language.
  const fallbackKeywords = language === 'en' ? ['a wish', 'life'] : ['生活', '愿望'];
  const localizedKeywords = language === 'en'
    ? (keywords.length > 0 ? keywords.map(kw => LOCAL_KEYWORD_EN[kw] || kw) : fallbackKeywords)
    : (keywords.length > 0 ? keywords : fallbackKeywords);

  return {
    domain: bestDomain,
    keywords: localizedKeywords,
    mood: bestMood,
    title: title || description.slice(0, language === 'en' ? 40 : 15),
  };
}

// Minimal EN gloss for the local (offline) keyword matcher's Chinese hits.
const LOCAL_KEYWORD_EN: Record<string, string> = {
  家人: 'family', 家庭: 'family', 孩子: 'children', 父母: 'parents',
  工作: 'work', 事业: 'career', 创业: 'startup', 项目: 'project',
  钱: 'money', 收入: 'income', 存款: 'savings', 投资: 'investing', 被动收入: 'passive income',
  健康: 'health', 运动: 'exercise', 睡眠: 'sleep', 减肥: 'fitness',
  创作: 'creating', 写作: 'writing', 艺术: 'art', 音乐: 'music', 设计: 'design',
  生活: 'life', 旅行: 'travel', 房子: 'home', 习惯: 'habit',
  爱: 'love', 爱情: 'love', 伴侣: 'partner', 婚姻: 'marriage', 感情: 'relationship',
};

// Full single-line-illustration art direction, written for a capable model
// that can actually plan SVG geometry. Encodes the aesthetic AND the specific
// failure modes we've seen (giant blob figures, disconnected scribbles).
const SVG_GENERATION_PROMPT = `You are the illustrator for Wishflow — a gentle, life-long wish app. Draw ONE quiet, hand-drawn line-art SVG that lovingly represents the user's wish. The house style is minimal ink-on-warm-paper — but this should read as a considered little VIGNETTE with a sense of place and depth, not a lone floating icon.

# What "richer but still calm" means (follow exactly)
- A clear RECOGNIZABLE hero subject, PLUS a small world around it built in gentle LAYERS: a foreground detail or two, the midground hero, and a soft far background (distant hills / a horizon / a few stars). Depth comes from layering, not from clutter.
- THE DEFINING PROP RULE: before drawing, name the ONE object that makes this wish THIS wish (a bakery → loaves in a window and a hanging sign; a marathon → a race bib or finish banner; a piano dream → the piano). That prop MUST be clearly drawn on or beside the hero. If a stranger couldn't guess the wish from the drawing, it fails.
- ICONIC WHOLE-OBJECT RULE: draw the hero object COMPLETE, from the outside, as its most recognizable profile silhouette — a ship = full hull + stacked deck layers + funnel with one smoke curl + a row of porthole dots; a house = the whole house; a van = the whole van. NEVER zoom into a fragment or first-person view: a railing without the ship, a counter without the room, hands without a figure all fail — even if the wish text mentions the fragment ("at the railing" still means DRAW THE WHOLE SHIP, with small figures on its deck). Simple stacked geometric masses read best; a short row of dots (portholes / windows) gives the silhouette rhythm.
- 6 to 10 elements total. Every element earns its place and relates to the wish — no random confetti.
- SPATIAL CLARITY (critical): exactly ONE ground/horizon line runs through the scene. At most 4 background curves total (hills, path, breeze), and background lines must NEVER cross each other or the hero — a tangle of intersecting curves reads as scribble, not depth.
- Continuous, confident, gently wobbly pen strokes. Curves over rigid corners. Vary line weight for depth (near = heavier, far = lighter).
- Add SPARSE texture to suggest material without shading: 2–5 short parallel hatch strokes for a shadow under the subject, a few tick-marks for grass / water / wood grain. Keep it whisper-light.
- The hero should feel ALIVE and specific: a boat leaning with the wave, smoke curling from a chimney, a figure mid-gesture — a caught moment, not a static logo.
- Never include <text>, numbers, logos, realistic shading, gradients, or large solid-filled shapes. fill="none" on everything except tiny dot accents (r ≤ 3). Keep generous breathing room around the whole scene.

# Proportion rules (critical — avoids ugly output)
- Draw a PERSON as a GESTURE FIGURE in the same single-line spirit as the scene: ONE flowing curved stroke for the spine and torso (never a straight stick), a small tilted oval head (r 5–8), a single stroke suggesting hair, and exactly one clothing hint (a coat hem, a skirt line, a rolled sleeve). Limbs are gently curved lines with implied elbows and knees, caught mid-gesture with weight on one leg. NO facial features — emotion lives entirely in posture: a tilted head reads as tenderness, arms wide as joy, a lean as longing. Think one-line figure drawing, not a rigid stick figure. People are SMALL accents, never giant ovals or filled blobs.
- Everything rests on a believable ground / water line at a plausible relative size — nothing floats randomly.
- Keep the whole drawing inside the safe area x: 30-370, y: 24-200.

# Canvas & depth palette
- viewBox MUST be "0 0 400 220". The hero sits centered, slightly low (around x 200, y 95-160).
- Foreground / hero outline: stroke="#2E2B33" stroke-width="2.6".
- Midground support: stroke="#6B5C8E" stroke-width="1.8".
- Far background + texture hatching: stroke="#B5A8D0" stroke-width="1.3" with lower opacity.
- Every stroke: stroke-linecap="round" stroke-linejoin="round" (put these on a wrapping <g> so all children inherit).

# Motion (only for flowing things — and make it VISIBLE)
Add a small <style> with these keyframes and animate ONLY water, clouds, mist, smoke, or starlight — never the boat / house / person. Motion must be noticeable at a glance (small amplitudes read as a broken image):
<style>
@keyframes wave { from { transform: translateX(0); } to { transform: translateX(-32px); } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
</style>
Waves: stroke-dasharray="14 8" style="animation: wave 5s linear infinite". Clouds / mist / smoke: style="animation: float 5s ease-in-out infinite". Animate at least TWO flowing elements in every scene.

# What to draw for different wishes (hero + a layered little world around it)
Pick concrete imagery from the wish (draw the noun, not a symbol):
- travel / sea: a small sailboat leaning on gentle waves; add a low sun, a distant shore, a bird or two, foam ticks and a soft reflection.
- family / love: a cozy home or two close figures mid-gesture; add a small tree, chimney smoke, a heart accent, a shadow beneath.
- home / peace: a pitched-roof house with door, window and a curl of smoke; add a path, a small tree, distant hills, grass ticks.
- money / growth: a seed growing into a steady tree with deepening roots; add gentle hills, a low sun, a small sprout nearby — never coins-as-progress-bar.
- health: a figure jogging or stretching on a winding path through hills; add a sprout, a leaf, a low sun, a faint calm horizon.
- creation: an open book or easel with a pen and a flowing creative line lifting into a few stars; add an inkwell, a small plant, a desk line.
- direction / future: a winding path over layered hills toward a rising sun or a single guiding star, with a small figure setting out.

# Output
Output ONLY the SVG, from <svg ...> to </svg>, nothing before or after. No <text>, <script>, <foreignObject>, external links, or event attributes.

User's wish:
{description}

Now draw the SVG:`;

const SVG_RETRY_PROMPT = `${SVG_GENERATION_PROMPT}

Your previous attempt failed these quality checks:
{issues}

Fix them and output ONLY the corrected <svg>...</svg>.`;

function extractTextContent(response: { content?: Array<{ type: string; text?: string }> }): string {
  const textContent = response.content?.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text' || !textContent.text) {
    throw new AIError('No text response from Claude', 'INVALID_RESPONSE');
  }
  return textContent.text;
}

function extractJson<T>(raw: string): T {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AIError('Could not parse JSON from response', 'PARSE_ERROR');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

function extractSvg(raw: string): string | null {
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
}

function buildSvgPrompt(template: string, description: string, issues?: string[]): string {
  return template
    .replace('{description}', description)
    .replace('{issues}', issues?.map(issue => `- ${issue}`).join('\n') ?? '');
}

export function sanitizeWishSvg(svg: string): string {
  let safe = svg.trim();
  safe = safe.replace(/<script[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  safe = safe.replace(/\s+(href|xlink:href)\s*=\s*(['"])\s*(https?:|data:|javascript:)[\s\S]*?\2/gi, '');
  safe = safe.replace(/<text[\s\S]*?<\/text>/gi, '');
  safe = safe.replace(/<svg(?![^>]*viewBox=)/i, '<svg viewBox="0 0 400 220"');
  safe = safe.replace(/viewBox=(['"])[^'"]*\1/i, 'viewBox="0 0 400 220"');
  return safe;
}

export function validateWishSvg(svg: string): SVGValidationResult {
  const issues: string[] = [];
  const safe = sanitizeWishSvg(svg);

  if (!/^<svg[\s\S]*<\/svg>$/i.test(safe)) {
    issues.push('SVG must contain a single root <svg> element.');
  }
  if (!/viewBox="0 0 400 220"/i.test(safe)) {
    issues.push('SVG must use viewBox="0 0 400 220".');
  }
  if (/<(?:script|foreignObject|text)\b/i.test(safe)) {
    issues.push('SVG must not include script, foreignObject, or text elements.');
  }
  if (/\son[a-z]+\s*=/i.test(safe)) {
    issues.push('SVG must not include event handler attributes.');
  }
  if (/\b(?:href|xlink:href)\s*=\s*(['"])\s*(?:https?:|data:|javascript:)/i.test(safe)) {
    issues.push('SVG must not include external links or data URLs.');
  }

  const drawableCount = (safe.match(/<(path|circle|ellipse|rect|line|polyline|polygon)\b/gi) ?? []).length;
  const pathCount = (safe.match(/<path\b/gi) ?? []).length;
  if (drawableCount < 8 || pathCount < 3) {
    issues.push('SVG is too sparse; build a layered little scene — a hero subject plus foreground and soft background.');
  }
  if (drawableCount > 64) {
    issues.push('SVG is too busy; keep it a calm vignette, not a crowded illustration.');
  }
  if (!/stroke-linecap="round"/i.test(safe) || !/stroke-linejoin="round"/i.test(safe)) {
    issues.push('SVG should use round line caps and joins.');
  }
  // The prompt explicitly allows tiny filled dot accents (circles r ≤ 3), so
  // only large filled shapes count against the "mostly line art" rule —
  // otherwise a flower field's dot centers would fail an otherwise good scene.
  const filledTags = safe.match(/<(?:path|circle|ellipse|rect|polygon|polyline)\b[^>]*\bfill="(?!none|transparent)[^"]*"[^>]*>/gi) ?? [];
  const largeFilledCount = filledTags.filter(tag => {
    const r = tag.match(/^<circle\b/i) ? parseFloat(tag.match(/\br="([\d.]+)"/i)?.[1] ?? '99') : 99;
    return r > 3.5;
  }).length;
  if (largeFilledCount > 3) {
    issues.push('SVG has too many filled shapes; keep it mostly line art (tiny dot accents are fine).');
  }

  return {
    ok: issues.length === 0,
    svg: safe,
    issues,
  };
}

// Which model provider handles AI calls (classification AND SVG drawing).
// Prefer Gemini (generous free tier) when a GEMINI_API_KEY is present;
// otherwise fall back to Anthropic. Set neither and the route quietly uses
// local classification + the hand-drawn template instead.
type AIProvider = 'gemini' | 'anthropic';
export function aiProvider(): AIProvider | null {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

// One "prompt in → raw text out" model call, routed to the active provider.
// Both providers get the exact same prompt and feed the same validation/retry
// loop, so the art stays in one visual language regardless of who drew it.
async function requestSvgText(prompt: string, provider: AIProvider): Promise<string> {
  if (provider === 'gemini') {
    return requestGeminiText(prompt, process.env.GEMINI_API_KEY!, 16000);
  }
  // Anthropic — Sonnet draws far better geometry than Haiku.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2600,
    messages: [{ role: 'user', content: prompt }],
  });
  return extractTextContent(response);
}

// Google Gemini free-tier path via the REST endpoint (no extra dependency).
//
// Model chain (2026-07-17 artcompare round 2): gemini-3-flash draws visibly
// better scenes than 2.5-flash — the cruise/cello/van test set went from
// "generic / template" to "a stranger guesses the wish". Free-tier quota is
// per-model-bucket, so we fall through the chain on 429/404 instead of dying
// with one exhausted bucket (which used to dump every user on the domain
// template — the main source of off-topic art). GEMINI_MODEL env still wins.
//
// Newer models "think" by default and the thoughts eat the output budget
// (a small cap truncates SVGs mid-path) — so each model is tried with
// thinking disabled first, then plain if it rejects the flag.
const GEMINI_DRAW_CHAIN = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function requestGeminiText(prompt: string, apiKey: string, maxOutputTokens: number): Promise<string> {
  const chain = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...GEMINI_DRAW_CHAIN.filter(m => m !== process.env.GEMINI_MODEL)]
    : GEMINI_DRAW_CHAIN;

  const callModel = async (model: string, disableThinking: boolean) => {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens,
          ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
  };

  let lastError = '';
  for (const model of chain) {
    let res = await callModel(model, true);
    if (!res.ok && res.status !== 429 && res.status !== 404) {
      // Some models reject thinkingConfig outright — retry plain before failing.
      res = await callModel(model, false);
    }
    if (res.status === 429 || res.status === 404) {
      // Quota-exhausted or retired model: move to the next bucket in the chain.
      lastError = `${model}: ${res.status}`;
      logger.debug(`[Gemini] ${model} unavailable (${res.status}), trying next in chain`);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AIError(`Gemini API error ${res.status}: ${body.slice(0, 200)}`, 'GEMINI_ERROR');
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p?.text).filter(Boolean).join('')
      : '';
    if (!text) {
      throw new AIError('Gemini returned no text', 'INVALID_RESPONSE');
    }
    return text;
  }
  throw new AIError(`All Gemini models exhausted (${lastError})`, 'GEMINI_QUOTA');
}

/**
 * Generate SVG visualization using the active AI provider (Gemini or Claude).
 * @param description - The wish description to visualize
 * @returns SVG string and success status
 */
export async function generateWishSVGWithAI(description: string): Promise<SVGGenerationResult> {
  logger.debug('[SVG Generator] Starting AI SVG generation for:', description.slice(0, 50) + '...');
  
  if (!description || description.trim().length < 5) {
    logger.debug('[SVG Generator] Error: Description too short');
    return { svg: '', success: false, error: 'Description too short' };
  }

  const provider = aiProvider();
  if (!provider) {
    logger.debug('[SVG Generator] Error: no provider configured');
    return { svg: '', success: false, error: 'API key not configured' };
  }

  try {
    logger.debug(`[SVG Generator] Calling ${provider} for SVG...`);
    const startTime = Date.now();

    // One direct "prompt in → SVG out" call, routed to whichever provider has a
    // key. Template fallback in the route covers the rare miss, so a model
    // error here is never fatal.
    const requestSvg = (prompt: string) => requestSvgText(prompt, provider);

    let raw = await requestSvg(buildSvgPrompt(SVG_GENERATION_PROMPT, description));
    logger.debug('[SVG Generator] Raw response length:', raw.length);

    let svg = extractSvg(raw);
    if (!svg) {
      logger.debug('[SVG Generator] Error: No SVG found in response');
      return { svg: '', success: false, error: 'No SVG found in response' };
    }

    let validation = validateWishSvg(svg);
    if (!validation.ok) {
      logger.debug('[SVG Generator] SVG validation failed, retrying:', validation.issues);
      raw = await requestSvg(buildSvgPrompt(SVG_RETRY_PROMPT, description, validation.issues));
      svg = extractSvg(raw);
      if (!svg) {
        return { svg: '', success: false, error: 'Retry did not return SVG', validationIssues: validation.issues };
      }
      validation = validateWishSvg(svg);
    }

    if (!validation.ok || !validation.svg) {
      logger.debug('[SVG Generator] SVG validation failed after retry:', validation.issues);
      return {
        svg: validation.svg ?? '',
        success: false,
        error: `SVG failed quality checks: ${validation.issues.join('; ')}`,
        validationIssues: validation.issues,
      };
    }

    const elapsed = Date.now() - startTime;
    logger.debug(`[SVG Generator] Claude API responded in ${elapsed}ms`);
    return { svg: validation.svg, success: true };

  } catch (error) {
    logger.error('[SVG Generator] API Error:', error);
    return {
      svg: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
