// Round 2 (quota-friendly): does a scene-spec stage fix 词不达意, and is
// gemini-3-flash a better free painter than the quota-dead flash-latest?
//   B. gemini-3-flash-preview, current prompt, single shot
//   C. spec (gemini-3.1-flash-lite) → gemini-3-flash-preview draw with plan
// Judged by human eyes via the HTML gallery — no LLM judge (free tier can't
// afford one per generation, and Flash-reading-coordinates proved too noisy).
// Saves incrementally to scripts/artcompare2.json after every wish.
import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const gkey = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!gkey) { console.error('no gemini key'); process.exit(1); }

const DRAW_MODEL = 'gemini-3-flash-preview';
const SPEC_MODEL = 'gemini-3.1-flash-lite';

const DRAW_PROMPT = readFileSync(new URL('../lib/ai.ts', import.meta.url), 'utf8')
  .match(/const SVG_GENERATION_PROMPT = `([\s\S]*?)`;\n\nconst SVG_RETRY_PROMPT/)[1]
  .replace(/\\`/g, '`');

const SPEC_PROMPT = `A user wrote this wish. Plan a tiny hand-drawn line-art scene that would make a STRANGER guess the wish correctly at a glance. Quote the wish's own concrete nouns — never substitute a generic symbol for a specific thing.

Wish: {d}

Return JSON only:
{
  "hero": "the single main subject, a concrete drawable thing taken from the wish",
  "definingProps": ["2-3 small drawable details that make this wish THIS wish (signs, tools, objects)"],
  "people": "how many figures and what they are doing, or 'none'",
  "background": ["1-3 soft far elements (horizon, hills, stars...)"],
  "motion": ["1-2 flowing things worth animating (waves, smoke, steam...)"],
  "mustNotDrawAs": "the lazy generic scene a careless artist would draw instead (to avoid)"
}`;

const SPEC_DRAW_SUFFIX = `

# SCENE PLAN (follow it exactly — this plan defines what "on-topic" means)
{spec}

Draw the hero and EVERY defining prop clearly. Do NOT draw the scene described in "mustNotDrawAs".`;

const wishes = [
  { id: 'cruise', label: '和爸妈坐一次邮轮', d: 'Take a cruise trip with my mom and dad — the three of us at the ship railing, ocean wind in our faces.' },
  { id: 'cello', label: '学会大提琴', d: 'Learn to play the cello well enough to perform one piece for my friends in my living room.' },
  { id: 'van', label: '房车环游全国', d: 'Convert a campervan and drive it around the whole country, waking up somewhere new.' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getSvg = t => (t.match(/<svg[\s\S]*?<\/svg>/i) || [''])[0];
const getJson = t => { try { return JSON.parse((t.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { return {}; } };

async function gem(model, prompt, maxTokens = 16000, attempt = 0) {
  const call = thinkOff => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gkey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens, ...(thinkOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
  });
  let res = await call(true);
  if (!res.ok && res.status !== 429) res = await call(false);
  if (res.status === 429 && attempt < 2) {
    process.stderr.write(`    429 on ${model}, backing off 25s...\n`);
    await sleep(25000);
    return gem(model, prompt, maxTokens, attempt + 1);
  }
  if (!res.ok) throw new Error(`${model} ${res.status}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text).filter(Boolean).join('');
}

const outUrl = new URL('./artcompare2.json', import.meta.url);
const out = {};
for (const w of wishes) {
  process.stderr.write(`── ${w.id}\n`);
  const drawPrompt = DRAW_PROMPT.replace('{description}', w.d);

  let bSvg = '', cSvg = '', spec = {};
  try { bSvg = getSvg(await gem(DRAW_MODEL, drawPrompt)); } catch (e) { process.stderr.write(`  B fail: ${e.message}\n`); }
  await sleep(4000);
  try {
    spec = getJson(await gem(SPEC_MODEL, SPEC_PROMPT.replace('{d}', w.d), 900));
    await sleep(2000);
    cSvg = getSvg(await gem(DRAW_MODEL, drawPrompt + SPEC_DRAW_SUFFIX.replace('{spec}', JSON.stringify(spec, null, 2))));
  } catch (e) { process.stderr.write(`  C fail: ${e.message}\n`); }

  out[w.id] = { label: w.label, wish: w.d, spec, B: { svg: bSvg }, C: { svg: cSvg } };
  writeFileSync(outUrl, JSON.stringify(out, null, 2));
  process.stderr.write(`  saved (B ${bSvg.length}b, C ${cSvg.length}b)\n`);
  await sleep(4000);
}
process.stderr.write('done -> scripts/artcompare2.json\n');
