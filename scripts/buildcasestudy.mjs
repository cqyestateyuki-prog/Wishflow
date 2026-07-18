// Assemble the portfolio case-study deck (English, PPT-style, self-contained
// single HTML) from the product docs + research JSONs. Re-run whenever samples improve.
//   narrative: 愿航 mini PRD, 愿望启航.md, docs/为什么选择简笔画.md
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
<title>Wishflow — A Navigation System for Wishes, Not Tasks</title>
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
    /* one centered 920px content column — padding does the centering so
       every child (headings, bullets, quotes) shares the same left edge */
    padding: 7vh max(clamp(24px, 7vw, 110px), calc((100vw - 920px) / 2));
  }
  .eyebrow { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--wish); font-weight: 600; margin-bottom: 18px; }
  h1 { font-family: var(--serif); font-size: clamp(38px, 5.6vw, 74px); line-height: 1.08; font-weight: 600; max-width: 20ch; }
  h2 { font-family: var(--serif); font-size: clamp(28px, 3.8vw, 48px); line-height: 1.15; font-weight: 600; margin-bottom: 22px; max-width: 26ch; }
  p.lead { font-size: clamp(15px, 1.4vw, 18px); color: var(--text); max-width: 66ch; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: clamp(20px, 3vw, 44px); align-items: start; margin-top: 30px; }
  .art .sheet { background: #fff; border: 1.5px solid rgba(145,127,185,0.5); border-radius: 22px; padding: clamp(10px, 1.6vw, 22px); box-shadow: 0 1px 2px rgba(46,43,51,.07), 0 8px 20px rgba(46,43,51,.07); }
  .art figcaption { font-size: 12.5px; color: var(--text); margin-top: 10px; text-align: center; }
  .art.big .sheet { padding: clamp(16px, 2.4vw, 34px); }
  ul.points { margin: 22px 0 0 1.1em; color: var(--text); font-size: 15.5px; max-width: 60ch; }
  ul.points li { margin-bottom: 12px; }
  ul.points b { color: var(--ink); }
  .tag { display: inline-block; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px; font-weight: 600; }
  .tag.before { color: #A04040; background: rgba(160,64,64,.08); }
  .tag.after { color: #3D7A4F; background: rgba(61,122,79,.09); }
  .quote { font-family: var(--serif); font-size: clamp(20px, 2.2vw, 28px); line-height: 1.45; color: var(--ink); border-left: 3px solid var(--wish-soft); padding-left: 22px; max-width: 34ch; margin-top: 26px; }
  .pageno { position: absolute; bottom: 26px; right: clamp(24px, 7vw, 110px); font-size: 12px; color: var(--text); opacity: .55; letter-spacing: .1em; }
  .footline { position: absolute; bottom: 26px; left: clamp(24px, 7vw, 110px); font-size: 12px; color: var(--text); opacity: .55; }
  /* two-audience comparison */
  .compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: clamp(22px, 4vw, 54px); margin-top: 28px; max-width: 860px; }
  .compare .colnote { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; font-weight: 600; margin-bottom: 10px; }
  .compare .colnote.them { color: var(--text); opacity: .75; }
  .compare .colnote.us { color: var(--wish); }
  .compare ul { margin: 0 0 0 1.05em; font-size: 15px; color: var(--text); }
  .compare li { margin-bottom: 10px; }
  .compare .us-col li b { color: var(--ink); }
  /* life-stage bar */
  .stages { display: flex; flex-wrap: wrap; margin-top: 30px; border-top: 1.6px solid var(--wish-soft); max-width: 880px; }
  .stage { flex: 1 1 0; min-width: 140px; padding: 14px 14px 0 0; border-left: 1px dashed rgba(145,127,185,.4); padding-left: 14px; }
  .stage:first-child { border-left: none; padding-left: 0; }
  .stage b { display: block; font-size: 14px; color: var(--ink); font-family: var(--serif); }
  .stage span { font-size: 12.5px; color: var(--text); line-height: 1.5; display: block; margin-top: 4px; }
  /* three moons of connection */
  .moons { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: clamp(20px, 3vw, 44px); margin-top: 30px; max-width: 880px; }
  .moon svg { display: block; margin-bottom: 12px; }
  .moon b { font-size: 15.5px; font-family: var(--serif); }
  .moon p { font-size: 14px; color: var(--text); margin-top: 4px; }
  /* product trio */
  .trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: clamp(20px, 3vw, 44px); margin-top: 30px; }
  .trio .room svg { display: block; width: 100%; height: auto; margin-bottom: 12px; background: #fff; border: 1.5px solid rgba(145,127,185,0.4); border-radius: 18px; }
  .trio b { font-size: 16px; font-family: var(--serif); }
  .trio p { font-size: 13.5px; color: var(--text); margin-top: 5px; }
  .manifesto { font-family: var(--serif); font-size: clamp(22px, 2.6vw, 34px); line-height: 1.5; max-width: 28ch; margin-top: 30px; }
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

<!-- 01 · Cover -->
<section>
  <p class="eyebrow">Wishflow · Product Case Study</p>
  <h1>A navigation system for wishes, not tasks.</h1>
  <p style="font-family:var(--serif); font-style:italic; font-size:clamp(17px,1.6vw,21px); color:var(--wish); margin-top:14px">"Let the wish slowly take shape."</p>
  <p class="lead" style="margin-top:18px">Wishflow is a small web app for wishes that take decades, not weeks. Each one gets drawn as a single hand-drawn line and then stays with you. This case study covers the thinking behind it: who it's for, why it works the way it does, and how we taught an AI to draw like this.</p>
  <div class="cols" style="max-width:760px">
    ${art(after.cruise?.svg, '"Take a cruise trip with my mom and dad" — a wish portrait, generated live by the production pipeline', true)}
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

<!-- 02 · Problem discovery -->
<section>
  <p class="eyebrow">Problem Discovery</p>
  <h2>Nobody has a good place to keep a wish.</h2>
  <p class="lead">Most people keep their biggest wishes in the worst places: sticky notes, chat logs with themselves, a notes app they're afraid to open. That's fine for groceries and terrible for something you'll carry for ten years. The goal apps that should help came up in our interviews mostly as the reason people quit:</p>
  <ul class="points">
    <li><b>"I write the wish down — and then I don't dare look at it again."</b> The note turns into a list of everything you haven't done yet.</li>
    <li><b>"One look at someone else doing better, and I want to give up."</b> Comparison came up in interviews more often than failure did.</li>
    <li><b>"One low mood, and my whole life goes offline."</b> The app shows a broken streak. People in this group didn't restart. They uninstalled.</li>
  </ul>
  <p class="lead" style="margin-top:22px">The pattern under all three: goal apps exist to close tasks, and a ten-year wish was never supposed to be closed.</p>
  <p class="quote">It's not that you can't. It's that you're too real.</p>
  <div class="pageno">02</div>
</section>

<!-- 03 · The user -->
<section>
  <p class="eyebrow">The User</p>
  <h2>Designed for the highly sensitive.</h2>
  <p class="lead">Wishflow is built for highly sensitive people, and for the plan-averse (MBTI would call them P types). They feel a lot, notice everything, and a bad week can take a wish offline for months. It's a much bigger group than the industry admits — and most productivity mechanics were designed by, and for, the other kind of person. The same features land very differently here:</p>
  <div class="compare">
    <div>
      <p class="colnote them">For a typical productivity user</p>
      <ul>
        <li>Streaks motivate</li>
        <li>Deadlines create focus</li>
        <li>Progress bars reward</li>
        <li>Metrics make it a game</li>
        <li>A failure state prompts a restart</li>
      </ul>
    </div>
    <div class="us-col">
      <p class="colnote us">For a highly sensitive user</p>
      <ul>
        <li><b>Streaks threaten</b> — every day is a chance to break something</li>
        <li><b>Deadlines paralyze</b> — under pressure, they stop wanting the thing at all</li>
        <li><b>Progress bars judge</b> — 12% mostly reads as "88% left"</li>
        <li><b>Metrics feel like being watched</b> — the inner life doesn't want a dashboard</li>
        <li><b>A failure state wounds</b> — they don't restart, they leave</li>
      </ul>
    </div>
  </div>
  <p class="lead" style="margin-top:26px">So we took the machinery out: <b>no scores, no rankings, no comparisons, no failure states anywhere.</b> The original spec says it best: the system carries the structure — the user is only responsible for existing and feeling.</p>
  <div class="pageno">03</div>
</section>

<!-- 04 · The insight -->
<section>
  <p class="eyebrow">The Insight</p>
  <h2>Wishes are non-linear.</h2>
  <p class="lead">The people we designed for don't move through life in a straight line, and their wishes don't finish on schedule. A real wish can go quiet for six years and come back changed. So the app doesn't count days at all. It thinks in <b>life stages</b>, and instead of completion it tracks one much softer thing: <b>whether you're still in touch</b>.</p>
  <svg viewBox="0 0 640 100" style="max-width:640px;margin-top:26px" aria-hidden="true">
    <path d="M 10 26 H 560" stroke="#C9C2D6" stroke-width="1.6" stroke-dasharray="7 7" fill="none"/>
    <path d="M 556 20 L 566 26 L 556 32" stroke="#C9C2D6" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M 585 18 L 601 34 M 601 18 L 585 34" stroke="#A04040" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>
    <text x="10" y="14" font-size="11.5" fill="#4A5568" letter-spacing="1.5">A PLAN</text>
    <path d="M 10 72 C 60 46 88 96 138 74 C 188 52 178 34 228 56 C 278 78 300 92 350 68 C 400 44 402 60 452 70 C 502 80 530 58 566 62" stroke="#6B5C8E" stroke-width="2" fill="none" stroke-linecap="round"/>
    <text x="10" y="96" font-size="11.5" fill="#6B5C8E" letter-spacing="1.5">A LIFE</text>
  </svg>
  <div class="stages">
    <div class="stage"><b>13–18</b><span>vague longing — wishes are feelings, not plans</span></div>
    <div class="stage"><b>18–25</b><span>exploring &amp; comparing — direction sways, lines break</span></div>
    <div class="stage"><b>25–35</b><span>reality collision — wishes get reshaped under pressure</span></div>
    <div class="stage"><b>35–50</b><span>slow grounding — some wishes quietly land</span></div>
    <div class="stage"><b>50+</b><span>looking back — the life map becomes visible</span></div>
  </div>
  <ul class="points">
    <li><b>"A wish is not a task — it's a relationship."</b> It can sit untouched for years and nothing bad happens to it. Nothing gets deleted.</li>
    <li><b>The wording is allowed to change.</b> "Earn 25k" becomes "stable freedom" as the person grows up — and the original stays saved, like a photo from that year.</li>
    <li><b>There is exactly one question in the whole app:</b> when did you last connect with this wish?</li>
  </ul>
  <p class="quote">A wish is allowed to pause, to change shape, to move slowly.</p>
  <div class="pageno">04</div>
</section>

<!-- 05 · The mechanism -->
<section>
  <p class="eyebrow">The Mechanism</p>
  <h2>Two minutes counts.</h2>
  <p class="lead">There's no schedule. Every wish offers three ways to connect, sized to how much you have in you that day — and on a bad day, two minutes of just looking at the drawing is a full visit. The app treats it exactly the same as an hour of real-world work.</p>
  <div class="moons">
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><path d="M 39 8 A 25.5 25.5 0 1 0 39 57 A 20 20 0 1 1 39 8 Z" fill="none" stroke="#6B5C8E" stroke-width="1.9" stroke-linejoin="round"/></svg>
      <b>2 minutes — minimum</b>
      <p>Open the drawing. Look at it. Let yourself still want it. That's the whole thing.</p>
    </div>
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="#6B5C8E" stroke-width="1.9"/><path d="M 32 7 C 28 20 28 44 32 57" fill="none" stroke="#6B5C8E" stroke-width="1.7"/><path d="M 32 12 C 42 16 46 44 32 52" fill="none" stroke="#B5A8D0" stroke-width="1.4" opacity=".6"/></svg>
      <b>15 minutes — normal</b>
      <p>Write the wish one line, or take one small step toward it.</p>
    </div>
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="#6B5C8E" stroke-width="1.9"/><circle cx="32" cy="32" r="21.5" fill="none" stroke="#B5A8D0" stroke-width="1.3" stroke-dasharray="3 5" opacity=".7"/></svg>
      <b>60 minutes — deep</b>
      <p>Actually move something in the real world. Rare, and never required.</p>
    </div>
  </div>
  <ul class="points">
    <li><b>The app records one thing: when you last connected.</b> There's no streak, no completion rate, nothing that can break.</li>
    <li><b>Come back after three quiet months and it says "you came back."</b> Not "you broke a 41-day streak."</li>
  </ul>
  <p class="quote">A wish doesn't disappear just because the line went quiet.</p>
  <div class="pageno">05</div>
</section>

<!-- 06 · Design philosophy -->
<section>
  <p class="eyebrow">Design Philosophy</p>
  <h2>In the age of flawless AI images, we stopped the pen at one-tenth.</h2>
  <p class="lead">AI made "polished" free. Anyone can render a flawless image in seconds now, so a flawless image says nothing — and our users already scroll past hundreds of them a day, feeling a little worse each time. So Wishflow goes the other way: every wish is one wobbly, trembling ink line on warm paper, like a doodle in the corner of your own notebook. A wish isn't a product to be rendered complete to prove its worth; it's a relationship, kept gently, for a long time — and its most precious part is what's left undrawn. Three reasons, none of them budget:</p>
  <ul class="points">
    <li><b>It feels human.</b> A hyperreal render performs; a hand-drawn line just keeps you company. It's a page from your journal, not a poster to be liked. Your wish is cherished, not inspected.</li>
    <li><b>It leaves room.</b> A finished render decides what your future looks like, down to the light fixtures. A line drawing settles maybe a tenth of it, and the rest — the boat, the house, the future not yet arrived — stays yours to imagine. The wish stays malleable, alive, yours.</li>
    <li><b>You can join in.</b> Nobody looks at a polished render and thinks "I could make that." A simple line says: you could draw this too. So users can upload their own sketches, and they hang next to the AI's with no visible seam.</li>
  </ul>
  <p class="quote">Wishflow stops the pen at one-tenth — the other nine-tenths were always yours to imagine, to finish, to own. Restraint isn't absence; restraint is the design.</p>
  <div class="pageno">06</div>
</section>

<!-- 07 · The product -->
<section>
  <p class="eyebrow">The Product</p>
  <h2>Three rooms, and no to-do list in any of them.</h2>
  <p class="lead">The core loop is short: write one sentence, the AI draws the wish a portrait, the wish moves into the gallery and stays for years. Around that loop there are three rooms:</p>
  <div class="trio">
    <div class="room">
      <svg viewBox="0 0 240 130">
        <path d="M 18 108 Q 120 28 222 84" fill="none" stroke="#B5A8D0" stroke-width="1.4" stroke-dasharray="5 7" opacity=".7"/>
        <path d="M 30 44 Q 120 96 214 40" fill="none" stroke="#B5A8D0" stroke-width="1.2" stroke-dasharray="4 8" opacity=".45"/>
        <circle cx="58" cy="86" r="2.6" fill="#6B5C8E"/><circle cx="118" cy="56" r="3.2" fill="#6B5C8E"/>
        <circle cx="172" cy="72" r="2.4" fill="#6B5C8E"/><circle cx="200" cy="48" r="2" fill="#8B7BB0"/>
        <circle cx="84" cy="38" r="1.8" fill="#8B7BB0"/>
        <path d="M 118 56 L 172 72" stroke="#6B5C8E" stroke-width="1" opacity=".5"/>
      </svg>
      <b>Wish Galaxy — the wide view</b>
      <p>Like looking up at the night sky. Every wish still there, laid out by life stage: "my wishes are all still here — I haven't failed."</p>
    </div>
    <div class="room">
      <svg viewBox="0 0 240 130">
        <path d="M -5 78 Q 60 58 120 76 Q 180 94 245 72" fill="none" stroke="#9C8CC2" stroke-width="1.5" stroke-dasharray="9 8" opacity=".6"/>
        <path d="M -5 104 Q 70 88 140 102 Q 195 112 245 98" fill="none" stroke="#B5A8D0" stroke-width="1.3" stroke-dasharray="7 9" opacity=".45"/>
        <g transform="translate(118 62) scale(1.7)">
          <path d="M -13 0 L -8 7 Q 0 10 8 7 L 13 0 Z M -13 0 L -3 0 L 0 -8 L 3 0 L 13 0" fill="#FFFFFF" stroke="#5B4B84" stroke-width="1.4" stroke-linejoin="round"/>
        </g>
        <path d="M 96 84 Q 106 88 116 84" fill="none" stroke="#8B7BB0" stroke-width="1.1" opacity=".5"/>
      </svg>
      <b>Life River — the daily view</b>
      <p>Like walking along a river. At most three wishes drift by a day, and the smallest connection counts as moving.</p>
    </div>
    <div class="room">
      <svg viewBox="0 0 240 130">
        <rect x="78" y="12" width="84" height="106" rx="12" fill="#FFFFFF" stroke="#8B7BB0" stroke-width="1.5"/>
        <circle cx="104" cy="42" r="9" fill="none" stroke="#2E2B33" stroke-width="1.6"/>
        <path d="M 88 74 Q 104 56 120 72 Q 136 86 152 68" fill="none" stroke="#2E2B33" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="104" cy="98" r="3" fill="none" stroke="#6B5C8E" stroke-width="1.3"/>
        <circle cx="120" cy="98" r="3" fill="none" stroke="#6B5C8E" stroke-width="1.3"/>
        <circle cx="136" cy="98" r="3" fill="#6B5C8E" opacity=".7"/>
      </svg>
      <b>Wish Card — one wish, up close</b>
      <p>The "relationship license" between you and a wish — a drawing you can open, sit with, and manifest. No checkbox anywhere.</p>
    </div>
  </div>
  <div class="pageno">07</div>
</section>

<!-- 08 · Craft: the problem -->
<section>
  <p class="eyebrow">Craft · The AI Illustrator</p>
  <h2>The drawings kept missing the wish.</h2>
  <p class="lead">The drawing is what a user keeps for years, so it has to pass a hard test: someone who's never seen the wish should guess it from the picture in a second or two, and it should feel drawn, not diagrammed. We had to hit that on a free-tier model budget — and early on, we were missing on every count:</p>
  <div class="cols">
    <div>
      <span class="tag before">Before</span>
      <p class="lead">"Take a cruise trip with my mom and dad." The model drew the <em>railing</em> and lost the entire ship. The people were stiff stick-men. And when the day's quota ran out, users silently got a generic template that ignored their words completely.</p>
      <ul class="points">
        <li><b>Dead model path:</b> the strongest configured painter had no credit; nobody noticed.</li>
        <li><b>One quota bucket:</b> when the free model hit its daily wall, every user fell to canned domain templates.</li>
        <li><b>No semantic check:</b> validation counted elements and viewBoxes — never asked "is this the wish?"</li>
      </ul>
    </div>
    ${art(beforeCruise, 'Before: the cruise wish — railing without a ship, stick figures', true)}
  </div>
  <div class="pageno">08</div>
</section>

<!-- 09 · Fix 1 -->
<section>
  <p class="eyebrow">Fix 01 · Infrastructure</p>
  <h2>A better painter — and a quota that never dies.</h2>
  <p class="lead">Now the drawing call walks down a chain of free-tier models, each with its own separate quota. When one hits its daily wall, the next one picks up the brush. Nobody lands on a template anymore.</p>
  <div class="chain">
    <div class="nodebox"><b>gemini-3-flash</b><br><span style="font-size:12px;color:var(--text)">primary painter</span></div>
    <svg width="34" height="16" viewBox="0 0 34 16"><path d="M2 8 Q 12 4 24 8 M 20 4 L 25 8 L 20 12" fill="none" stroke="#6B5C8E" stroke-width="1.8" stroke-linecap="round"/></svg>
    <div class="nodebox dim"><b>3.1-flash-lite</b><br><span style="font-size:12px;color:var(--text)">on 429 / 404</span></div>
    <svg width="34" height="16" viewBox="0 0 34 16"><path d="M2 8 Q 12 4 24 8 M 20 4 L 25 8 L 20 12" fill="none" stroke="#B5A8D0" stroke-width="1.8" stroke-linecap="round"/></svg>
    <div class="nodebox dim"><b>flash-latest</b><br><span style="font-size:12px;color:var(--text)">last resort</span></div>
  </div>
  <ul class="points">
    <li><b>We also tried being clever</b> — a scene-planning stage, then a blind LLM judge to score drawings. Both made results worse: the weak planner kept steering the ship right out of its own picture. We deleted both and kept a sharper prompt on a stronger model.</li>
    <li><b>What stayed:</b> structural validation and one retry. The semantic quality lives in the prompt now.</li>
  </ul>
  <div class="pageno">09</div>
</section>

<!-- 10 · Fix 2 -->
<section>
  <p class="eyebrow">Fix 02 · Figures</p>
  <h2>People without faces.</h2>
  <p class="lead">The person in a wish drawing is supposed to be <em>you</em>. Comics have a name for why simple faces help with that — the masking effect: the less specific the face, the easier it is to put yourself inside it. We drew the same wish three ways to check:</p>
  <div class="cols">
    ${art(beforeCruise, 'Stick figures — rigid, placeholder energy')}
    ${art(gestureG, 'One-line gesture figures, no faces — curved spines, weight, tenderness. ✓ Shipped')}
    ${art(faceF, 'Dot-eye faces — read as smudges at card size. Rejected')}
  </div>
  <p class="quote">All the emotion turned out to live in posture — a tilted head, arms out wide.</p>
  <div class="pageno">10</div>
</section>

<!-- 11 · Fix 3 -->
<section>
  <p class="eyebrow">Fix 03 · Composition</p>
  <h2>Draw the whole ship.</h2>
  <p class="lead">Minimal line art really only has one asset: the silhouette. So the prompt now carries a rule we call <b>iconic whole-object</b>: draw the main thing complete, in profile, from the outside — hull, stacked decks, funnel, a row of porthole dots. Never a first-person fragment of it.</p>
  <div class="cols">
    ${art(beforeCruise, 'Before: "at the railing" → the model drew a railing')}
    ${art(after.cruise?.svg, 'After: "at the railing" still means draw the whole ship — with the family small on deck')}
  </div>
  <p class="quote">"At the railing" still means: draw the ship.</p>
  <div class="pageno">11</div>
</section>

<!-- 12 · After gallery -->
<section>
  <p class="eyebrow">After</p>
  <h2>The same pipeline, today.</h2>
  <p class="lead"><span class="tag after">After</span> Straight from the production prompt, no edits. Whole silhouettes, gesture figures, and one slowly moving element in each scene — smoke, water, stars.</p>
  <div class="cols">
    ${art(after.cruise?.svg, 'A cruise with mom & dad')}
    ${art(after.bakery?.svg, 'A little bakery by the sea')}
    ${art(after.cello?.svg, 'Learn the cello')}
    ${art(after.van?.svg, 'A campervan around the country')}
  </div>
  <div class="pageno">12</div>
</section>

<!-- 13 · Principles + manifesto -->
<section>
  <p class="eyebrow">What Carried Over</p>
  <h2>Four principles we kept.</h2>
  <ul class="points" style="font-size:16.5px; max-width: 62ch">
    <li><b>Minimal is a discipline.</b> It needs a weighted line, one row of detail, one caught moment of motion. Without those it reads as a child's doodle — we know, because ours did.</li>
    <li><b>Evidence beats architecture.</b> The two cleverest stages of our pipeline died in testing. A better prompt on a better model quietly won.</li>
    <li><b>Design for the quota wall.</b> On free tiers, the fallback chain isn't plumbing — it's the reason no user ever sees a template.</li>
    <li><b>Motion is vocabulary.</b> Only water, smoke, clouds and starlight move, and slowly. The subject holds still.</li>
  </ul>
  <p class="manifesto">Wishflow doesn't get you there faster. It makes sure that, over a whole life, you never leave the direction you wanted to go.</p>
  <p style="font-family:var(--serif); font-style:italic; font-size:16.5px; color:var(--text); margin-top:18px">Take your time. The wish isn't going anywhere.</p>
  <div class="footline">Wishflow · 2026 — drawings in this deck are live SVG, animated as shipped</div>
  <div class="pageno">13</div>
</section>

</body>
</html>`;

const outDir = new URL('../../portfolio/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outPath = new URL('../../portfolio/wishflow-line-art-case-study.html', import.meta.url);
writeFileSync(outPath, html);
console.log('deck ->', outPath.pathname, `(${(html.length / 1024).toFixed(0)}kb)`,
  '| after samples present:', Object.keys(after).join(', ') || 'none');
