/**
 * WishVisualization Component / 愿望可视化组件
 * Renders animated SVG visualization based on wish domain and mood
 * Prioritizes AI-generated svg_data, falls back to domain-based templates
 * 根据愿望领域和情绪渲染动画 SVG 可视化
 * 优先使用 AI 生成的 svg_data，回退到领域模板
 */

'use client';

import { useMemo } from 'react';
import { LocalWish } from '@/lib/localStore';
import { WishDomain, WishMood } from '@/lib/types';
import { generateWishSVG, GeneratedSVG } from '@/lib/svgGenerator';
import styles from './WishCard.module.css';

type WishVisualizationProps = {
  wish: LocalWish;
  size?: 'small' | 'medium' | 'large';
  showAnimation?: boolean;
  // Receives the click event so callers can FLIP-zoom from this element's rect
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

// Default values for older wishes without new fields
const DEFAULT_DOMAIN: WishDomain = '生活';
const DEFAULT_MOOD: WishMood = '平静';

export default function WishVisualization({
  wish,
  size = 'medium',
  showAnimation = true,
  onClick,
}: WishVisualizationProps) {
  // Highest priority: a drawing the user uploaded themselves
  const hasUserImage = Boolean(wish.user_image);

  // Check if wish has AI-generated SVG data
  const hasAISVG = !hasUserImage && Boolean(wish.svg_data);

  // Generate fallback SVG based on wish properties (only if no user image / AI SVG)
  const fallbackSvg = useMemo(() => {
    if (hasUserImage || hasAISVG) return null;
    
    const domain = (wish.domain as WishDomain) || DEFAULT_DOMAIN;
    const mood = (wish.mood as WishMood) || DEFAULT_MOOD;
    const seed = wish.line_seed || wish.title || wish.id;

    return generateWishSVG(domain, mood, seed);
  }, [hasUserImage, hasAISVG, wish.domain, wish.mood, wish.line_seed, wish.title, wish.id]);

  // Size configurations
  const sizeConfig = {
    small: { maxWidth: 120, padding: 8 },
    medium: { maxWidth: 200, padding: 12 },
    large: { maxWidth: 430, padding: 16 },
  };

  const config = sizeConfig[size];

  // Render SVG from GeneratedSVG data (fallback template)
  const renderFallbackSVG = (svgData: GeneratedSVG) => {
    const styleContent = showAnimation
      ? svgData.animations.map(a => `@keyframes ${a.name} { ${a.keyframes} }`).join('\n')
      : '';

    return (
      <svg 
        viewBox={svgData.viewBox} 
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}
      >
        {showAnimation && <style>{styleContent}</style>}
        <g>
          {svgData.paths.map((path, i) => (
            <path
              key={i}
              d={path.d}
              stroke={path.stroke}
              strokeWidth={path.strokeWidth}
              fill={path.fill}
              opacity={path.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={showAnimation ? { 
                animation: path.animation,
                transformOrigin: 'center',
              } : undefined}
            />
          ))}
          {svgData.decorations.map((dec, i) => {
            const style = showAnimation ? { 
              animation: dec.animation,
              transformOrigin: 'center',
            } : undefined;
            
            if (dec.type === 'circle') {
              return (
                <circle
                  key={`dec-${i}`}
                  cx={dec.props.cx as number}
                  cy={dec.props.cy as number}
                  r={dec.props.r as number}
                  fill={dec.props.fill as string || 'none'}
                  stroke={dec.props.stroke as string}
                  strokeWidth={dec.props.strokeWidth as number}
                  opacity={dec.props.opacity as number}
                  style={style}
                />
              );
            }
            if (dec.type === 'ellipse') {
              return (
                <ellipse
                  key={`dec-${i}`}
                  cx={dec.props.cx as number}
                  cy={dec.props.cy as number}
                  rx={dec.props.rx as number}
                  ry={dec.props.ry as number}
                  fill={dec.props.fill as string}
                  opacity={dec.props.opacity as number}
                  style={style}
                />
              );
            }
            return null;
          })}
        </g>
      </svg>
    );
  };

  return (
    <div 
      className={styles.visualization}
      style={{ 
        maxWidth: config.maxWidth, 
        padding: config.padding,
        cursor: onClick ? 'pointer' : undefined,
      }}
      onClick={onClick}
    >
      {/* Highest priority: the user's own drawing. Multiply blend drops a white-paper
          photo's background to the paper tone, so it reads as ink-on-paper like the AI art. */}
      {hasUserImage && wish.user_image ? (
        <img
          src={wish.user_image}
          alt={wish.title}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            mixBlendMode: 'multiply',
          }}
          className="wish-user-image"
        />
      ) : hasAISVG && wish.svg_data ? (
        <div 
          dangerouslySetInnerHTML={{ __html: wish.svg_data }}
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          className="wish-svg-ai"
        />
      ) : fallbackSvg ? (
        renderFallbackSVG(fallbackSvg)
      ) : null}
    </div>
  );
}
