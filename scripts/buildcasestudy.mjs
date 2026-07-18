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
  <p class="lead" style="margin-top:22px">Wishflow keeps a person's wishes alive across decades — drawn in one trembling ink line, connected to gently, never graded. This is why we built it, who it protects, and why it refuses to look like anything else the AI era produces.</p>
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
  <h2>Wishes don't fail. Tools fail them.</h2>
  <p class="lead">Life-level wishes usually live on sticky notes and in chat threads — places that can't hold years of emotional weather. And the tools built for "goals" make it worse. In interviews and in our own lives, the same three moments kept surfacing:</p>
  <ul class="points">
    <li><b>You write a wish down, then never dare look at it again.</b> The note has become a mirror of everything you haven't done.</li>
    <li><b>One glance at someone else's progress and you want to quit.</b> Comparison kills the wish faster than failure ever did.</li>
    <li><b>One low week, and the streak dies.</b> The tool calls it failure. You call it being a person — and you leave.</li>
  </ul>
  <p class="quote">Productivity tools are built to close tasks. A life-level wish is not a task to close.</p>
  <div class="pageno">02</div>
</section>

<!-- 03 · The user -->
<section>
  <p class="eyebrow">The User</p>
  <h2>Designed for the highly sensitive.</h2>
  <p class="lead">Wishflow is for highly sensitive people (HSP) and P-types — people who feel deeply, resist rigid plans, and are easily knocked off course by comparison, mood, and environment. This isn't a niche of "weak users": it's a population the entire productivity industry quietly optimizes against. The same mechanics read completely differently to them:</p>
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
        <li><b>Deadlines paralyze</b> — pressure disconnects them from wanting</li>
        <li><b>Progress bars judge</b> — 12% reads as "you are 88% behind"</li>
        <li><b>Metrics feel like surveillance</b> of their inner life</li>
        <li><b>A failure state wounds</b> — and they don't restart. They leave.</li>
      </ul>
    </div>
  </div>
  <p class="lead" style="margin-top:26px">So the rules here are different: <b>no evaluation, no ranking, no comparison, no failure states.</b> The system carries the structure; the user only has to exist and feel.</p>
  <div class="pageno">03</div>
</section>

<!-- 04 · The insight -->
<section>
  <p class="eyebrow">The Insight</p>
  <h2>Wishes are non-linear.</h2>
  <p class="lead">For this audience, life is not a straight line, and wishes do not complete on an annual plan. A real wish can sleep for six years and wake up changed. So Wishflow abandoned the calendar: its unit of time is the <b>life stage</b>, and its unit of progress is not completion — it's <b>connection</b>.</p>
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
    <li><b>A wish is a relationship object, not a goal.</b> It may pause for years. It is never deleted.</li>
    <li><b>Its wording evolves</b> — "earn 25k" becomes "stable freedom" — while its first form is kept, as memory.</li>
    <li><b>So nothing here asks "is it done?"</b> The only question the product ever asks: are you still connected?</li>
  </ul>
  <div class="pageno">04</div>
</section>

<!-- 05 · The mechanism -->
<section>
  <p class="eyebrow">The Mechanism</p>
  <h2>No plan. Just don't lose the line.</h2>
  <p class="lead">Instead of a schedule, every wish offers three sizes of connection. The system adapts to today's energy — it never demands that your energy adapt to the system. On a foggy day, two minutes of looking is enough to count as staying on course.</p>
  <div class="moons">
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><path d="M 39 8 A 25.5 25.5 0 1 0 39 57 A 20 20 0 1 1 39 8 Z" fill="none" stroke="#6B5C8E" stroke-width="1.9" stroke-linejoin="round"/></svg>
      <b>2 minutes — minimum</b>
      <p>Open the drawing. Look at it. Allow yourself to still want it. That's all.</p>
    </div>
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="#6B5C8E" stroke-width="1.9"/><path d="M 32 7 C 28 20 28 44 32 57" fill="none" stroke="#6B5C8E" stroke-width="1.7"/><path d="M 32 12 C 42 16 46 44 32 52" fill="none" stroke="#B5A8D0" stroke-width="1.4" opacity=".6"/></svg>
      <b>15 minutes — normal</b>
      <p>Write one line to the wish, or take one small real-world step toward it.</p>
    </div>
    <div class="moon">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="#6B5C8E" stroke-width="1.9"/><circle cx="32" cy="32" r="21.5" fill="none" stroke="#B5A8D0" stroke-width="1.3" stroke-dasharray="3 5" opacity=".7"/></svg>
      <b>60 minutes — deep</b>
      <p>Move something in the real world. Rare, unforced, and never required.</p>
    </div>
  </div>
  <ul class="points">
    <li><b>Only "last connected" is ever recorded.</b> No streaks, no completion rate, no missed-day count.</li>
    <li><b>Returning after silence has exactly one feedback:</b> "You came back." Not "you broke a 41-day streak."</li>
  </ul>
  <div class="pageno">05</div>
</section>

<!-- 06 · Design philosophy -->
<section>
  <p class="eyebrow">Design Philosophy</p>
  <h2>In the age of flawless AI images, we stopped the pen at one-tenth.</h2>
  <p class="lead">AI made polish free. When anyone can render a hyperreal 3D scene in seconds, polish stops meaning anything — a feed of perfect images is just high-stimulation noise, and our audience is already exhausted by it. So Wishflow made the counterintuitive choice: <b>don't render — suggest.</b> One wobbly ink line on warm paper, like a doodle in the corner of your own notebook. Not maximalist AI content. Not a dopamine machine. Deliberate restraint, for three reasons:</p>
  <ul class="points">
    <li><b>Humanity.</b> A hyperreal render performs — it spends every pixel proving how capable it is. A hand-drawn line proves nothing; it just keeps you company. Your wish is cherished, not inspected.</li>
    <li><b>Negative space.</b> A finished render locks the wish into one fixed picture and closes your imagination. A single line draws one-tenth and leaves the boat, the house, the future — to you. The image stays still; your relationship with it keeps changing. That's what "a wish is an evolving relationship" requires.</li>
    <li><b>Participation.</b> A perfect render intimidates: "I could never make that." A humble line invites: "you could draw this too." Users upload their own sketches in the same visual language — and "the app's drawing" and "my drawing" stop being different things.</li>
  </ul>
  <p class="quote">Restraint isn't absence. Restraint is the design.</p>
  <div class="pageno">06</div>
</section>

<!-- 07 · The product -->
<section>
  <p class="eyebrow">The Product</p>
  <h2>Three rooms, one quiet loop.</h2>
  <p class="lead">Write a wish in one sentence → the AI illustrator draws its portrait → the wish lives in the gallery for years. Around that loop, three rooms — none of which contains a to-do list:</p>
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
      <b>Wish Galaxy — look up</b>
      <p>Every wish still shining, arranged by life stage. The feeling it exists to give: "I haven't failed."</p>
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
      <b>Life River — today</b>
      <p>At most three wishes surface per day. The smallest connection counts as moving.</p>
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
      <b>Wish Card — the relationship</b>
      <p>A hand-drawn portrait you can open, sit inside, and manifest — not a task with a checkbox.</p>
    </div>
  </div>
  <div class="pageno">07</div>
</section>

<!-- 08 · Craft: the problem -->
<section>
  <p class="eyebrow">Craft · The AI Illustrator</p>
  <h2>The drawings kept missing the wish.</h2>
  <p class="lead">The portrait is the soul of the loop, so the bar is high: a stranger should name the wish from the drawing in one second — and it should feel like art someone made, not a diagram. All of it on a free-tier model budget. At first, we failed on both counts:</p>
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
  <div class="pageno">08</div>
</section>

<!-- 09 · Fix 1 -->
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
  <div class="pageno">09</div>
</section>

<!-- 10 · Fix 2 -->
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
  <div class="pageno">10</div>
</section>

<!-- 11 · Fix 3 -->
<section>
  <p class="eyebrow">Fix 03 · Composition</p>
  <h2>Draw the whole ship.</h2>
  <p class="lead">Minimal line art lives and dies by the silhouette. The prompt now carries an <b>iconic whole-object rule</b>: the hero is always drawn complete, in profile, from the outside — hull, stacked decks, funnel, a row of porthole dots. Never a first-person fragment.</p>
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
  <p class="lead"><span class="tag after">After</span> Fresh, unedited generations from the production prompt — whole-object silhouettes, gesture figures, one animated flowing element in every scene.</p>
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
    <li><b>Minimal is a discipline, not a shortcut.</b> Weighted line hierarchy, one signature detail row, a caught moment of motion — or it reads as a child's doodle.</li>
    <li><b>Evidence beats architecture.</b> Two clever pipeline stages died in testing; a sharper prompt on a stronger painter won.</li>
    <li><b>Design for the quota wall.</b> On free tiers, resilience <em>is</em> product quality — the fallback chain is why users never see a template again.</li>
    <li><b>Motion is vocabulary, not decoration.</b> Only water, smoke, clouds and starlight move — slowly. The subject holds still, like a memory.</li>
  </ul>
  <p class="manifesto">Wishflow doesn't help you get there faster. It makes sure that, in any state of life, you never leave your own direction.</p>
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
