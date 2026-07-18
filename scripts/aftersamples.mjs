// Portfolio "after" samples: run the CURRENT production prompt (model chain
// head gemini-3-flash-preview, gesture figures, iconic whole-object rule)
// over the case-study wishes. Saves incrementally; pass ids as argv to
// regenerate only those (quality-gate rejects).
// Run: node scripts/aftersamples.mjs [cruise bakery ...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const gkey = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
const MODEL = 'gemini-3-flash-preview';

const DRAW_PROMPT = readFileSync(new URL('../lib/ai.ts', import.meta.url), 'utf8')
  .match(/const SVG_GENERATION_PROMPT = `([\s\S]*?)`;\n\nconst SVG_RETRY_PROMPT/)[1]
  .replace(/\\`/g, '`');

const WISHES = {
  cruise: 'Take a cruise trip with my mom and dad — the three of us at the ship railing, ocean wind in our faces.',
  bakery: 'Open a little bakery by the sea — fresh loaves in the window, salt air, a hand-painted sign.',
  cello: 'Learn to play the cello well enough to perform one piece for my friends in my living room.',
  van: 'Convert a campervan and drive it around the whole country, waking up somewhere new.',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getSvg = t => (t.match(/<svg[\s\S]*?<\/svg>/i) || [''])[0];

async function gem(prompt, attempt = 0) {
  const call = thinkOff => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gkey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  let res = await call(true);
  if (!res.ok && res.status !== 429) res = await call(false);
  if (res.status === 429 && attempt < 2) { await sleep(25000); return gem(prompt, attempt + 1); }
  if (!res.ok) throw new Error(`${MODEL} ${res.status}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text).filter(Boolean).join('');
}

const outUrl = new URL('./aftersamples.json', import.meta.url);
const out = existsSync(outUrl) ? JSON.parse(readFileSync(outUrl, 'utf8')) : {};
const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WISHES);

for (const id of targets) {
  if (!WISHES[id]) { console.error(`unknown id ${id}`); continue; }
  process.stderr.write(`── ${id}\n`);
  try {
    const svg = getSvg(await gem(DRAW_PROMPT.replace('{description}', WISHES[id])));
    out[id] = { wish: WISHES[id], svg };
    writeFileSync(outUrl, JSON.stringify(out, null, 2));
    process.stderr.write(`  saved ${svg.length}b\n`);
  } catch (e) {
    process.stderr.write(`  fail: ${e.message}\n`);
  }
  await sleep(4000);
}
process.stderr.write('done -> scripts/aftersamples.json\n');
