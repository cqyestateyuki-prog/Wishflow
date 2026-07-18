// Time scope for wishes
export type TimeScope = 'short' | 'long';

// Target time for achieving the wish
export type TargetTime = 'weeks' | 'months' | 'years';

// Mood types for SVG generation
export type WishMood = '温暖' | '激励' | '平静' | '期待' | '自由';

// Domain types
export type WishDomain = '家人' | '事业' | '钱' | '健康' | '创造' | '生活' | '爱';

export type Wish = {
  id: string;
  user_id: string;
  title: string;                          // Short title (can be auto-generated from description)
  description: string | null;             // Full wish description
  domain: string | null;                  // Auto-classified domain
  stage: string | null;                   // Life stage
  will_source: string | null;             // Will source
  end_scene: string | null;               // End vision
  time_scope: TimeScope | null;           // Short-term or long-term
  target_time: TargetTime | null;         // Target completion time
  svg_pattern: string | null;             // SVG pattern identifier (legacy)
  svg_data: string | null;                // AI-generated SVG string (full <svg>...</svg>)
  keywords: string[] | null;              // AI-extracted keywords for SVG
  mood: WishMood | null;                  // Mood for SVG animation
  line_seed: string | null;               // Seed for consistent SVG generation
  user_image?: string | null;             // User-uploaded drawing (compressed data URL); overrides AI art, revertible. Local-only, like svg_data.
  pinned: boolean | null;
  last_connected_at: string | null;
  last_level: string | null;
  created_at: string;
  updated_at: string;
};

export type Connection = {
  id: string;
  user_id: string;
  wish_id: string;
  level: string;
  mood: string | null;
  note: string | null;
  connected_at: string;
  created_at: string;
};

export type Fragment = {
  id: string;
  user_id: string;
  source: string;
  content: string;
  linked_wish_ids: string[];
  created_at: string;
};
