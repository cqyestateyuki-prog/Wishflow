import fs from 'fs';
const dir = process.argv[2];
const en = JSON.parse(fs.readFileSync(dir + '/scripts/ui-kit/wishes-en.json','utf8'));
const zh = JSON.parse(fs.readFileSync(dir + '/scripts/ui-kit/wishes-zh.json','utf8'));
if (en.length !== zh.length) throw new Error('en/zh length mismatch');
const seeds = en.map((e, i) => {
  const z = zh[i];
  return {
    id: 'sample_' + (i + 1),
    titleEn: e.title, titleZh: z.title,
    descEn: e.description, descZh: z.description,
    domain: e.domain, mood: e.mood, svg_pattern: e.svg_pattern,
    time_scope: e.time_scope, target_time: e.target_time,
    keywords: e.keywords,
    created_at: e.created_at,
    svg_data: e.svg_data,
  };
});
const body = `// AUTO-GENERATED sample wishes (bilingual demo content for the empty Wish Gallery).
// Source: scripts/ui-kit/wishes-en.json + wishes-zh.json. Display-only — never persisted.
// To regenerate: node scripts/gen-samples.mjs (kept in repo docs).
import type { LocalWish } from './localStore';
import type { WishMood, WishDomain } from './types';

type SampleSeed = {
  id: string;
  titleEn: string; titleZh: string;
  descEn: string; descZh: string;
  domain: WishDomain; mood: WishMood; svg_pattern: string;
  time_scope: 'short' | 'long'; target_time: 'weeks' | 'months' | 'years';
  keywords: string[]; created_at: string; svg_data: string;
};

const SAMPLES: SampleSeed[] = ${JSON.stringify(seeds, null, 2)};

/** Localized, display-only sample wishes shown when the gallery is empty.
 *  Not saved to localStorage — they switch with the UI language and vanish
 *  the moment the visitor creates a real wish. */
export function getSampleWishes(language: 'en' | 'zh'): LocalWish[] {
  const zh = language === 'zh';
  return SAMPLES.map((s) => ({
    id: s.id,
    title: zh ? s.titleZh : s.titleEn,
    description: zh ? s.descZh : s.descEn,
    domain: s.domain,
    stage: null,
    will_source: null,
    end_scene: null,
    time_scope: s.time_scope,
    target_time: s.target_time,
    svg_pattern: s.svg_pattern,
    svg_data: s.svg_data,
    keywords: s.keywords,
    mood: s.mood,
    line_seed: s.id,
    pinned: false,
    last_connected_at: null,
    last_level: null,
    created_at: s.created_at,
    updated_at: s.created_at,
    synced: false,
  }));
}
`;
fs.writeFileSync(dir + '/lib/sampleWishes.ts', body);
console.log('written lib/sampleWishes.ts,', seeds.length, 'samples,', body.length, 'bytes');
console.log('titles EN:', seeds.map(s=>s.titleEn).join(' | '));
console.log('titles ZH:', seeds.map(s=>s.titleZh).join(' | '));
