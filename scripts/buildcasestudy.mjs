// Assemble the portfolio case-study deck (English, PPT-style, self-contained
// single HTML) from the research JSONs. Re-run whenever samples improve.
//   before: scripts/figstyle.json (stick-figure / railing-only era)
//   after:  scripts/aftersamples.json (current production prompt)
// Output: ../portfolio/wishflow-line-art-case-study.html
// Run: node scripts/buildcasestudy.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const fig = JSON.parse(readFileSync(new URL('./figstyle.json', import.meta.url), 'utf8'));
const after = existsSync(new URL('./aftersamples.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./aftersamples.json', import.meta.url), 'utf8'))
  : {};

const fit = (svg, h = 'auto') =>
  (svg || '').replace(/<svg /i, `<svg style="width:100%;height:${h};display:block" `);

const art = (svg, cap = '', big = false) => svg ? `
  <figure class="art${big ? ' big' : ''}">
    <div class="sheet">${fit(svg)}</div>
    ${cap ? `<figcaption>${cap}</figcaption>` : ''}
  </figure>` : '';

const beforeCruise = fig.cruise?.results?.S?.svg || '';
const gestureG = fig.cruise?.results?.G?.svg || '';
const faceF = fig.cruise?.results?.F?.svg || '';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Teaching AI to Draw a Wish — Wishflow Case Study</title>
<style>
  :root {
    --paper: #FAF9F7; --ink: #2E2B33; --text: #4A5568;
    --wish: #6B5C8E; --wish-soft: #B5A8D0; --mist: #EEE9F5;
    --serif: "Fraunces", Georgia, "Songti SC", ui-serif, serif;
    --sans: "Work Sans", "Avenir Next", ui-sans-serif, system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  html { scroll-snap-type: y mandatory; }
  body { background: var(--paper); color: var(--ink); font-family: var(--sans); line-height: 1.7; }
  section {
    min-height: 100vh; scroll-snap-align: start;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
    /* one centered 1060px content column — padding does the centering so
       every child (headings, bullets, quotes) shares the same left edge */
    padding: 7vh max(clamp(24px, 7vw, 110px), calc((100vw - 920px) / 2));
  }
  .eyebrow { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--wish); font-weight: 600; margin-bottom: 18px; }
  h1 { font-family: var(--serif); font-size: clamp(38px, 5.6vw, 74px); line-height: 1.08; font-weight: 600; max-width: 20ch; }
  h2 { font-family: var(--serif); font-size: clamp(28px, 3.8vw, 48px); line-height: 1.15; font-weight: 600; margin-bottom: 22px; max-width: 24ch; }
  p.lead { font-size: clamp(15px, 1.4vw, 18px); color: var(--text); max-width: 62ch; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: clamp(20px, 3vw, 44px); align-items: start; margin-top: 30px; }
  .art .sheet { background: #fff; border: 1.5px solid rgba(145,127,185,0.5); border-radius: 22px; padding: clamp(10px, 1.6vw, 22px); box-shadow: 0 1px 2px rgba(46,43,51,.07), 0 8px 20px rgba(46,43,51,.07); }
  .art figcaption { font-size: 12.5px; color: var(--text); margin-top: 10px; text-align: center; }
  .art.big .sheet { padding: clamp(16px, 2.4vw, 34px); }
  ul.points { margin: 22px 0 0 1.1em; color: var(--text); font-size: 15.5px; max-width: 58ch; }
  ul.points li { margin-bottom: 12px; }
  ul.points b { color: var(--ink); }
  .tag { display: inline-block; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px; font-weight: 600; }
  .tag.before { color: #A04040; background: rgba(160,64,64,.08); }
  .tag.after { color: #3D7A4F; background: rgba(61,122,79,.09); }
  .quote { font-family: var(--serif); font-size: clamp(20px, 2.2vw, 28px); line-height: 1.45; color: var(--ink); border-left: 3px solid var(--wish-soft); padding-left: 22px; max-width: 30ch; margin-top: 26px; }
  .pageno { position: absolute; bottom: 26px; right: clamp(24px, 7vw, 110px); font-size: 12px; color: var(--text); opacity: .55; letter-spacing: .1em; }
  .footline { position: absolute; bottom: 26px; left: clamp(24px, 7vw, 110px); font-size: 12px; color: var(--text); opacity: .55; }
  /* chain diagram */
  .chain { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 26px; }
  .chain .nodebox { border: 1.6px solid var(--wish); border-radius: 16px; padding: 12px 18px; font-size: 13.5px; background: #fff; color: var(--ink); }
  .chain .dim { border-color: var(--wish-soft); color: var(--text); }
  .chain svg { flex: none; }
  /* ambient */
  .riverline { position: absolute; left: 0; right: 0; pointer-events: none; }
  .drift { stroke-dasharray: 18 13; animation: drift 14s linear infinite; }
  .drift2 { stroke-dasharray: 12 11; animation: drift 20s linear infinite; }
  @keyframes drift { to { stroke-dashoffset: -62; } }
  .boatbob { animation: bob 4.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
  @keyframes bob { 0%,100% { transform: translateY(0) rotate(-2deg);} 50% { transform: translateY(-3px) rotate(2.2deg);} }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  @media print { section { min-height: auto; page-break-after: always; } }
</style>
</head>
<body>

<!-- 1 · Cover -->
<section>
  <p class="eyebrow">Wishflow · AI Art Pipeline · Case Study</p>
  <h1>Teaching AI to draw a wish.</h1>
  <p class="lead" style="margin-top:22px">How a life-long wish companion turns one sentence into a living, hand-drawn scene — and what it took to make the drawings actually <em>mean</em> what the wish says.</p>
  <div class="cols" style="max-width:900px">
    ${art(after.cruise?.svg, '"Take a cruise trip with my mom and dad" — generated live by the current pipeline', true)}
  </div>
  <svg class="riverline" style="bottom:0;height:110px" viewBox="0 0 1200 120" preserveAspectRatio="none">
    <path class="drift" d="M -20 52 Q 200 24 420 54 Q 640 84 860 50 Q 1040 24 1220 52" fill="none" stroke="#9C8CC2" stroke-width="1.8" opacity=".45"/>
    <path class="drift2" d="M -20 92 Q 240 66 500 94 Q 760 120 1020 88 Q 1120 78 1220 90" fill="none" stroke="#B5A8D0" stroke-width="1.5" opacity=".35"/>
    <g transform="translate(930 40) scale(2)"><g class="boatbob">
      <path d="M -13 0 L -8 7 Q 0 10 8 7 L 13 0 Z M -13 0 L -3 0 L 0 -8 L 3 0 L 13 0" fill="#FAF9F7" stroke="#5B4B84" stroke-width="1.5" stroke-linejoin="round"/>
    </g></g>
  </svg>
  <div class="pageno">01</div>
</section>

<!-- 2 · Context -->
<section>
  <p class="eyebrow">Context</p>
  <h2>Wishflow keeps wishes for a lifetime. Every wish deserves a portrait.</h2>
  <p class="lead">Wishflow is a gentle, life-long wish companion for highly sensitive people — no streaks, no deadlines, no failure states. Its entire visual world is <b>one wobbly, hand-drawn ink line on warm paper</b>. When a user writes a wish, an AI illustrator draws it a small line-art vignette that will accompany that wish for years.</p>
  <ul class="points">
    <li><b>The bar:</b> minimal, but never crude. A stranger should name the wish from the drawing in one second — and it should feel like art someone made, not a diagram.</li>
    <li><b>The constraint:</b> a free-tier model budget. Every design decision below had to survive real quota walls.</li>
  </ul>
  <div class="pageno">02</div>
</section>

<!-- 3 · Problem -->
<section>
  <p class="eyebrow">Before</p>
  <h2>The drawings kept missing the wish.</h2>
  <div class="cols">
    <div>
      <span class="tag before">Before</span>
      <p class="lead">"Take a cruise trip with my mom and dad." The model drew the <em>railing</em> — and lost the ship. Figures were rigid stick-men. When quota ran dry, users silently got a generic template that had nothing to do with their words.</p>
      <ul class="points">
        <li><b>Dead model path:</b> the strongest configured painter had no credit; nobody noticed.</li>
        <li><b>One quota bucket:</b> when the free model hit its daily wall, every user fell to canned domain templates.</li>
        <li><b>No semantic check:</b> validation counted elements and viewBoxes — never asked "is this the wish?"</li>
      </ul>
    </div>
    ${art(beforeCruise, 'Before: the cruise wish — railing without a ship, stick figures', true)}
  </div>
  <div class="pageno">03</div>
</section>

<!-- 4 · Fix 1 -->
<section>
  <p class="eyebrow">Fix 01 · Infrastructure</p>
  <h2>A better painter — and a quota that never dies.</h2>
  <p class="lead">The drawing call now walks a chain of independent free-tier quota buckets. One bucket running dry no longer sends anyone to a template; it just hands the brush to the next model.</p>
  <div class="chain">
    <div class="nodebox"><b>gemini-3-flash</b><br><span style="font-size:12px;color:var(--text)">primary painter</span></div>
    <svg width="34" height="16" viewBox="0 0 34 16"><path d="M2 8 Q 12 4 24 8 M 20 4 L 25 8 L 20 12" fill="none" stroke="#6B5C8E" stroke-width="1.8" stroke-linecap="round"/></svg>
    <div class="nodebox dim"><b>3.1-flash-lite</b><br><span style="font-size:12px;color:var(--text)">on 429 / 404</span></div>
    <svg width="34" height="16" viewBox="0 0 34 16"><path d="M2 8 Q 12 4 24 8 M 20 4 L 25 8 L 20 12" fill="none" stroke="#B5A8D0" stroke-width="1.8" stroke-linecap="round"/></svg>
    <div class="nodebox dim"><b>flash-latest</b><br><span style="font-size:12px;color:var(--text)">last resort</span></div>
  </div>
  <ul class="points">
    <li><b>Evidence over architecture:</b> we prototyped a scene-planning stage and a blind LLM judge. Both tested <em>worse</em> than a strong painter with a sharp prompt — the weak planner steered the ship out of its own picture. We shipped neither.</li>
    <li><b>Structural validation + one retry</b> stayed; semantic quality moved into the prompt itself.</li>
  </ul>
  <div class="pageno">04</div>
</section>

<!-- 5 · Fix 2 -->
<section>
  <p class="eyebrow">Fix 02 · Figures</p>
  <h2>People without faces.</h2>
  <p class="lead">Wish drawings contain <em>you</em>. Comics theory calls it the masking effect: the simpler the face, the easier it is to step inside it. We tested three figure languages on the same wish:</p>
  <div class="cols">
    ${art(beforeCruise, 'Stick figures — rigid, placeholder energy')}
    ${art(gestureG, 'One-line gesture figures, no faces — curved spines, weight, tenderness. ✓ Shipped')}
    ${art(faceF, 'Dot-eye faces — read as smudges at card size. Rejected')}
  </div>
  <p class="quote">Emotion lives in posture: a tilted head is tenderness, arms wide is joy.</p>
  <div class="pageno">05</div>
</section>

<!-- 6 · Fix 3 -->
<section>
  <p class="eyebrow">Fix 03 · Composition</p>
  <h2>Draw the whole ship.</h2>
  <p class="lead">Minimal line art lives and dies by the silhouette. The prompt now carries an <b>iconic whole-object rule</b>: the hero is always drawn complete, in profile, from the outside — hull, stacked decks, funnel, a row of porthole dots. Never a first-person fragment.</p>
  <div class="cols">
    ${art(beforeCruise, 'Before: "at the railing" → the model drew a railing')}
    ${art(after.cruise?.svg, 'After: "at the railing" still means draw the whole ship — with the family small on deck')}
  </div>
  <p class="quote">"At the railing" still means: draw the ship.</p>
  <div class="pageno">06</div>
</section>

<!-- 7 · After gallery -->
<section>
  <p class="eyebrow">After</p>
  <h2>The same pipeline, today.</h2>
  <p class="lead"><span class="tag after">After</span> Fresh, unedited generations from the production prompt — whole-object silhouettes, gesture figures, one animated flowing element in every scene.</p>
  <div class="cols">
    ${art(after.cruise?.svg, 'A cruise with mom & dad')}
    ${art(after.bakery?.svg, 'A little bakery by the sea')}
    ${art(after.cello?.svg, 'Learn the cello')}
    ${art(after.van?.svg, 'A campervan around the country')}
  </div>
  <div class="pageno">07</div>
</section>

<!-- 8 · Principles -->
<section>
  <p class="eyebrow">What carried over</p>
  <h2>Four principles we kept.</h2>
  <ul class="points" style="font-size:17px; max-width: 64ch">
    <li><b>Minimal is a discipline, not a shortcut.</b> Weighted line hierarchy, one signature detail row, a caught moment of motion — or it reads as a child's doodle.</li>
    <li><b>Evidence beats architecture.</b> Two clever pipeline stages died in testing; a sharper prompt on a stronger painter won.</li>
    <li><b>Design for the quota wall.</b> On free tiers, resilience *is* product quality — the fallback chain is why users never see a template again.</li>
    <li><b>Motion is vocabulary, not decoration.</b> Only water, smoke, clouds and starlight move — slowly. The subject holds still, like a memory.</li>
  </ul>
  <p class="lead" style="margin-top:34px; font-family: var(--serif); font-size: 20px;">Leave your wish here. We'll draw the rest.</p>
  <div class="footline">Wishflow · 2026 — drawings in this deck are live SVG, animated as shipped</div>
  <div class="pageno">08</div>
</section>

</body>
</html>`;

const outDir = new URL('../../portfolio/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outPath = new URL('../../portfolio/wishflow-line-art-case-study.html', import.meta.url);
writeFileSync(outPath, html);
console.log('deck ->', outPath.pathname, `(${(html.length / 1024).toFixed(0)}kb)`,
  '| after samples present:', Object.keys(after).join(', ') || 'none');
