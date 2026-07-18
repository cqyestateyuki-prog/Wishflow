// One-off: generate wish line-art with the CURRENT prompt vs a RICHER prompt,
// so we can eyeball the quality ceiling. Reads ANTHROPIC_API_KEY from .env.local.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = (env.match(/^ANTHROPIC_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('no key'); process.exit(1); }
const client = new Anthropic({ apiKey: key });

const CURRENT = `You are the illustrator for Wishflow — a gentle, life-long wish app. Draw ONE quiet, hand-drawn, single-line-style SVG scene that lovingly represents the user's wish. Think Pinterest / Dribbble minimal line art, drawn with a calm confident pen on warm paper.

# The aesthetic (follow exactly)
- One clear, RECOGNIZABLE subject in generous empty space. A viewer should name it in one second.
- Continuous, flowing, gently wobbly strokes — like one unbroken pen line. Curves over rigid corners. A little organic imperfection is good; disconnected scribbles are not.
- Calm and minimal: ONE main subject + 2 to 4 small supporting elements. No clutter, no background fill.
- Never include <text>, numbers, logos, realistic shading, gradients, or large solid-filled shapes. fill="none" on everything except tiny dot accents (r ≤ 3).

# Proportion rules (critical — avoids ugly output)
- Draw a PERSON as small and gestural: a small circle head (r 5-8), a simple curved-line body, thin limbs. People are SMALL accents in the scene, never giant ovals.
- Objects should sit at believable size and rest on a ground/water line, not float randomly.
- Keep the whole drawing inside the safe area x: 40-360, y: 30-190.

# Canvas & lines
- viewBox MUST be "0 0 400 220". The subject sits centered, slightly low (around x 200, y 90-160).
- Main subject: stroke="#2E2B33" stroke-width="2.6". Supporting: stroke="#6B5C8E" stroke-width="1.8". Distant/background: stroke="#B5A8D0" stroke-width="1.4".
- Every stroke: stroke-linecap="round" stroke-linejoin="round" (put these on a wrapping <g> so all children inherit).

# What to draw
Pick concrete imagery from the wish (draw the noun, not a symbol).

# Output
Output ONLY the SVG, from <svg ...> to </svg>, nothing before or after. No <text>, <script>, <foreignObject>.

User's wish:
{d}

Now draw the SVG:`;

const RICHER = `You are the illustrator for Wishflow — a gentle, life-long wish app. Draw ONE quiet, hand-drawn line-art SVG that lovingly represents the user's wish. The house style is minimal ink-on-warm-paper — but this should read as a considered little VIGNETTE with a sense of place and depth, not a lone floating icon.

# What "richer but still calm" means (follow exactly)
- A clear RECOGNIZABLE hero subject, PLUS a small world around it built in gentle LAYERS: a foreground detail or two, the midground hero, and a soft far background (distant hills / horizon / a few stars). Depth comes from layering, not from clutter.
- 6 to 10 elements total. Every element earns its place and relates to the wish — no random confetti.
- Continuous, confident, gently wobbly pen strokes. Curves over corners. Vary line weight to create depth (near = heavier, far = lighter).
- Add SPARSE texture to suggest material without shading: 2-5 short parallel hatch strokes for a shadow under the subject, a few tick-marks for grass/water/wood grain. Keep it whisper-light.
- The main subject should feel ALIVE and specific: a boat leaning with the wave, smoke curling from a chimney, a figure mid-gesture — a caught moment, not a static logo.
- Still fill="none" everywhere except tiny dot accents (r ≤ 3). No <text>, numbers, gradients, or big solid fills. Still generous breathing room around the scene.

# Proportion
- A PERSON is small and gestural: circle head (r 5-8), curved-line body, thin limbs mid-motion. Never a giant oval blob.
- Everything rests on a believable ground/water line. Objects sit at plausible relative sizes.
- Keep the drawing inside x: 30-370, y: 24-200.

# Canvas, lines, depth palette
- viewBox MUST be "0 0 400 220". Hero centered, slightly low (x ~200, y 95-160).
- Foreground / hero outline: stroke="#2E2B33" stroke-width="2.6".
- Supporting midground: stroke="#6B5C8E" stroke-width="1.8".
- Far background + texture hatching: stroke="#B5A8D0" stroke-width="1.3".
- Every stroke: stroke-linecap="round" stroke-linejoin="round" on a wrapping <g> so children inherit.

# Motion (optional, only flowing things)
A small <style> with @keyframes; animate ONLY water/clouds/mist/starlight, never the hero.
@keyframes wave { from{transform:translateX(0)} to{transform:translateX(-20px)} }
Waves: stroke-dasharray="14 8" style="animation: wave 6s linear infinite".

# Output
Output ONLY the SVG, from <svg ...> to </svg>, nothing before or after. No <text>, <script>, <foreignObject>.

User's wish:
{d}

Now draw the SVG:`;

const wishes = [
  { id: 'sea',    label: '带爸妈去看一次海',      d: 'Take my parents to see the ocean — the three of us standing on a quiet beach at sunset.' },
  { id: 'cafe',   label: '开一家自己的小咖啡馆',  d: 'Open my own small cozy cafe with warm light, a few tables, and a plant in the window.' },
  { id: 'surf',   label: '学会冲浪',              d: 'Learn to surf — riding a wave on a longboard, free and a little scared.' },
  { id: 'save',   label: '存下人生第一个十万',    d: 'Save my first 100k — a small seed growing into a steady tree, roots deepening over years.' },
];

async function gen(prompt, d) {
  const r = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2600,
    messages: [{ role: 'user', content: prompt.replace('{d}', d) }],
  });
  const txt = r.content.find(b => b.type === 'text')?.text || '';
  const m = txt.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : '';
}

const out = {};
for (const w of wishes) {
  process.stderr.write(`generating ${w.id}...\n`);
  const [cur, rich] = await Promise.all([gen(CURRENT, w.d), gen(RICHER, w.d)]);
  out[w.id] = { label: w.label, current: cur, richer: rich };
}
writeFileSync(new URL('../../artcompare.json', import.meta.url), JSON.stringify(out));
process.stderr.write('done -> artcompare.json\n');
