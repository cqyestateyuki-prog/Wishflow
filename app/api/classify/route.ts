/**
 * Wish Classification API Route / 愿望分类 API 路由
 * POST /api/classify - Classify a wish description using Claude AI
 * Optionally generate SVG visualization with generateSVG: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { classifyWish, classifyWishLocal, generateWishSVGWithAI, aiProvider, AIError } from '@/lib/ai';
import { generateWishSVG, renderSVGToString } from '@/lib/svgGenerator';
import { checkSvgQuota } from '@/lib/svgQuota';
import { WishDomain, WishMood } from '@/lib/types';
import { logger } from "@/lib/logger";

// True when any SVG-drawing provider is configured (Gemini free tier or Anthropic).
const hasAIProvider = () =>
  !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
export async function POST(request: NextRequest) {
  logger.debug('[API /classify] Request received');

  // Parsed once here so the error handler can reuse it for graceful fallback
  // (the request body can only be read a single time).
  let body: any = {};

  try {
    body = await request.json();
    const { description, useLocal = false, generateSVG = false } = body;
    const language: 'en' | 'zh' = body.language === 'zh' ? 'zh' : 'en';

    logger.debug('[API /classify] Params:', { 
      descLength: description?.length, 
      useLocal, 
      generateSVG 
    });

    // Validate input
    if (!description || typeof description !== 'string') {
      logger.debug('[API /classify] Error: Missing description');
      return NextResponse.json(
        { error: '请提供愿望描述', code: 'MISSING_DESCRIPTION' },
        { status: 400 }
      );
    }

    if (description.trim().length < 5) {
      logger.debug('[API /classify] Error: Description too short');
      return NextResponse.json(
        { error: '愿望描述太短，请至少输入5个字', code: 'DESCRIPTION_TOO_SHORT' },
        { status: 400 }
      );
    }

    // Classification result
    let classification;
    let classificationSource = 'local';

    // Use local classification if requested or if no AI provider is configured.
    // An AI classification FAILURE must only degrade classification itself —
    // never abort the request, so SVG generation below still gets its chance.
    const provider = aiProvider();
    if (useLocal || !provider) {
      logger.debug('[API /classify] Using local classification');
      classification = classifyWishLocal(description, language);
      classificationSource = 'local';
    } else {
      logger.debug(`[API /classify] Using ${provider} for classification`);
      try {
        classification = await classifyWish(description, language);
        classificationSource = provider;
      } catch (err) {
        logger.error('[API /classify] AI classification failed, degrading to local:', err);
        classification = classifyWishLocal(description, language);
        classificationSource = 'local';
      }
    }

    logger.debug('[API /classify] Classification result:', {
      title: classification.title,
      domain: classification.domain,
      keywords: classification.keywords,
      source: classificationSource
    });

    // SVG generation (if requested)
    let svg: string | undefined;
    let svgFallback = false;
    let svgQualityIssues: string[] | undefined;
    let sceneSpec;
    let quotaExceeded = false;
    let quota: { used: number; limit: number } | undefined;

    if (generateSVG) {
      logger.debug('[API /classify] Starting SVG generation...');

      // AI drawing runs only when a provider is set and the user hasn't hit their
      // daily quota. Anything else (no provider, local mode, quota reached) draws
      // the hand-drawn template — never a blocked / empty state.
      let allowGeneration = hasAIProvider() && !useLocal;

      if (allowGeneration) {
        const q = await checkSvgQuota(request);   // null → fail open (unmetered)
        if (q) {
          quota = { used: q.used, limit: q.limit };
          if (!q.allowed) {
            allowGeneration = false;
            quotaExceeded = true;
            logger.debug('[API /classify] Daily SVG quota reached, using template');
          }
        }
      }

      if (allowGeneration) {
        const svgResult = await generateWishSVGWithAI(description);
        sceneSpec = svgResult.sceneSpec;
        svgQualityIssues = svgResult.validationIssues;
        if (svgResult.success && svgResult.svg) {
          logger.debug('[API /classify] AI SVG generation succeeded');
          svg = svgResult.svg;
        } else {
          // Fallback to domain-based template
          logger.debug('[API /classify] AI SVG failed, using fallback:', svgResult.error);
          svg = renderSVGToString(
            generateWishSVG(classification.domain as WishDomain, classification.mood as WishMood, description)
          );
          svgFallback = true;
        }
      } else {
        // No provider, local mode, or quota reached → template directly.
        svg = renderSVGToString(
          generateWishSVG(classification.domain as WishDomain, classification.mood as WishMood, description)
        );
        svgFallback = true;
      }

      logger.debug('[API /classify] SVG result:', {
        svgLength: svg?.length,
        svgFallback,
        svgQualityIssues,
        quotaExceeded,
      });
    }

    logger.debug('[API /classify] Returning response');
    return NextResponse.json({
      ...classification,
      source: classificationSource,
      ...(generateSVG && { svg, svgFallback, sceneSpec, svgQualityIssues, quotaExceeded, quota }),
    });

  } catch (error) {
    logger.error('Classification error:', error);

    // Only a genuinely invalid input should surface as an error; every
    // service-side failure (no credit, timeout, parse) degrades gracefully.
    if (error instanceof AIError && error.code === 'INVALID_INPUT') {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    // Graceful degradation: if the AI API is unavailable (e.g. no credit,
    // network error), still return a local classification AND a built-in
    // template drawing so the user never sees a stuck "Generating…" state.
    try {
      if (!body || typeof body.description !== 'string') throw new Error('no body');
      const result = classifyWishLocal(body.description, body.language === 'zh' ? 'zh' : 'en');
      const wantsSvg = body.generateSVG === true;
      let svg: string | undefined;
      if (wantsSvg) {
        const templateSVG = generateWishSVG(
          result.domain as WishDomain,
          result.mood as WishMood,
          body.description
        );
        svg = renderSVGToString(templateSVG);
      }
      return NextResponse.json({
        ...result,
        source: 'local',
        fallback: true,
        ...(wantsSvg && { svg, svgFallback: true }),
      });
    } catch {
      return NextResponse.json(
        { error: '分类服务暂时不可用', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }
  }
}

// Health check endpoint
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    status: 'ok',
    claudeAvailable: hasApiKey,
    fallbackAvailable: true,
  });
}
