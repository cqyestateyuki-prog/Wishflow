// Figure-style shootout: how should PEOPLE look in wish art?
//   S. stick   — current rule (circle head + thin limbs), control
//   G. gesture — one-line gesture figure: curved spine, hair stroke,
//                clothing hint, NO face; emotion lives in posture
//   F. face    — gesture figure + minimal face (two dot eyes, one smile curve)
// Two people-centric wishes; drawn by gemini-3-flash. Judged by eyes.
// Saves figstyle.json incrementally. Run: node scripts/figstyle.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const gkey = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
const DRAW_MODEL = 'gemini-3-flash-preview';

const BASE = readFileSync(new URL('../lib/ai.ts', import.meta.url), 'utf8')
  .match(/const SVG_GENERATION_PROMPT = `([\s\S]*?)`;\n\nconst SVG_RETRY_PROMPT/)[1]
  .replace(/\\`/g, '`');

const STICK_RULE = '- Draw a PERSON small and gestural: a small circle head (r 5–8), a simple curved-line body, thin limbs mid-motion. People are SMALL accents, never giant ovals or filled blobs.';

const GESTURE_RULE = `- Draw a PERSON as a GESTURE FIGURE in the same single-line spirit as the scene: ONE flowing curved stroke for the spine and torso (never a straight stick), a small tilted oval head, a single stroke suggesting hair, and exactly one clothing hint (a coat hem, a skirt line, a rolled sleeve). Limbs are gently curved lines with implied elbows and knees, caught mid-gesture with weight on one leg. NO facial features — emotion lives entirely in posture: a tilted head reads as tenderness, arms wide as joy, a lean as longing. Think one-line figure drawing (Quentin Blake energy), not a rigid stick figure. People stay SMALL relative to the scene.`;

const FACE_RULE = `${GESTURE_RULE}
- Additionally give each figure a MINIMAL face: two small ink dots for eyes and one short curved stroke for a smile, placed on the lower half of the head oval. Nothing else — no nose, eyebrows, or outlines inside the face.`;

const styles = [
  { id: 'S', label: '火柴人（现状）', rule: STICK_RULE },
  { id: 'G', label: '单线手势小人（无脸）', rule: GESTURE_RULE },
  { id: 'F', label: '手势小人 + 极简脸', rule: FACE_RULE },
];

const wishes = [
  { id: 'cruise', label: '和爸妈坐一次邮轮（远景人物）', d: 'Take a cruise trip with my mom and dad — the three of us at the ship railing, ocean wind in our faces.' },
  { id: 'bake', label: '和女儿一起烤饼干（近景人物）', d: 'Bake cookies with my little daughter on a Sunday afternoon — flour on our hands, warm smell filling the kitchen.' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getSvg = t => (t.match(/<svg[\s\S]*?<\/svg>/i) || [''])[0];

async function gem(model, prompt, attempt = 0) {
  const call = thinkOff => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gkey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 16000, thinkingConfig: thinkOff ? { thinkingBudget: 0 } : undefined },
    }),
  });
  let res = await call(true);
  if (!res.ok && res.status !== 429) res = await call(false);
  if (res.status === 429 && attempt < 2) { await sleep(25000); return gem(model, prompt, attempt + 1); }
  if (!res.ok) throw new Error(`${model} ${res.status}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text).filter(Boolean).join('');
}

const outUrl = new URL('./figstyle.json', import.meta.url);
const out = {};
for (const w of wishes) {
  out[w.id] = { label: w.label, wish: w.d, results: {} };
  for (const s of styles) {
    process.stderr.write(`── ${w.id} / ${s.id}\n`);
    const prompt = BASE.replace(STICK_RULE, s.rule).replace('{description}', w.d);
    let svg = '';
    try { svg = getSvg(await gem(DRAW_MODEL, prompt)); } catch (e) { process.stderr.write(`  fail: ${e.message}\n`); }
    out[w.id].results[s.id] = { label: s.label, svg };
    writeFileSync(outUrl, JSON.stringify(out, null, 2));
    await sleep(4000);
  }
}

// gallery
const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cell = r => `<td><div class="frame">${r.svg ? r.svg.replace(/<svg /i, '<svg style="width:100%;height:auto;display:block" ') : '<p style="color:#a04040">（失败）</p>'}</div></td>`;
const rows = Object.values(out).map(w => `
  <tr><td class="wishCell"><h3>${esc(w.label)}</h3><p class="wishText">${esc(w.wish)}</p></td>
  ${styles.map(s => cell(w.results[s.id])).join('')}</tr>`).join('');
const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>人物画法对比</title><style>
  body{font-family:ui-sans-serif,system-ui;background:#faf9f7;color:#2e2b33;margin:24px}
  h1{font-size:22px}
  table{border-collapse:separate;border-spacing:10px;width:100%}
  th{font-size:13px;color:#5e4e8c;text-align:left;padding:0 4px}
  td{vertical-align:top;background:#fff;border:1px solid rgba(214,206,233,.8);border-radius:14px;padding:10px;width:27%}
  .wishCell{background:transparent;border:none;width:16%;min-width:150px}
  .wishCell h3{margin:0 0 6px;font-size:14px}.wishText{font-size:12px;color:#4a5568;line-height:1.5}
  .frame{background:#faf9f7;border-radius:8px;padding:6px}
</style></head><body><h1>人物画法对比 · gemini-3-flash</h1>
<table><tr><th></th>${styles.map(s => `<th>${s.id} · ${s.label}</th>`).join('')}</tr>${rows}</table></body></html>`;
writeFileSync(new URL('../public/figstyle.html', import.meta.url), html);
process.stderr.write('done -> scripts/figstyle.json + public/figstyle.html\n');
