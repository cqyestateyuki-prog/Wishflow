/**
 * Wishflow UI Kit 截图 — 8 屏 × 中英 × 桌面/手机
 *
 *   npm i -D playwright && npx playwright install chromium   # 仅首次
 *   npx next dev -p 3040                                     # 另开一个终端
 *   node scripts/ui-kit/shoot.js                             # 种夹具 → 截图
 *   node scripts/ui-kit/shoot.js --generate                  # 重新真跑 AI 生成 4 个愿望并更新夹具
 *
 * 产出到 scripts/ui-kit/out/(已 gitignore), 压缩后进 public/ui-kit/shots/。
 *
 * ★为什么默认不重新生成: wishes-*.json 里存的是真跑 /try 生成的 4 个愿望(含 AI 画的
 *   svg_data 与 AI 起的标题)。种回 localStorage 秒出图, 不用每次烧 AI 额度。
 *   只有改了愿望卡的渲染、需要新内容时才 --generate。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const BASE = process.env.BASE || 'http://localhost:3040';
const REGEN = process.argv.includes('--generate');

// 屏 → 路由。Board/Galaxy/River 是同一路由的三个视图, 单独处理
const PAGES = [['home', '/'], ['try', '/try'], ['daily', '/daily'], ['login', '/login'], ['terms', '/terms']];
const VIEWS = { board: { en: 'Board', zh: '画板' }, galaxy: { en: 'Galaxy', zh: '星系' }, river: { en: 'River', zh: '河流' } };

const WISHES = {
  en: [
    ['I want to take my parents on a slow train trip across the country, and see the sea with them.', 'Long-term', 'Years'],
    ['Build and launch my own small product — something a few people truly rely on.', 'Long-term', 'Years'],
    ['Get back to swimming twice a week and feel at home in my body again.', 'Short-term', 'Months'],
    ['Find work that lets me keep making things and still keep my quiet mornings.', 'Long-term', 'Years'],
  ],
  zh: [
    ['带爸妈坐一次慢火车穿过大半个中国，陪他们看一次海。', '长期愿望', '几年内'],
    ['做出一个属于自己的小产品，有几个人真的离不开它。', '长期愿望', '几年内'],
    ['每周去游两次泳，重新住回自己的身体里。', '短期愿望', '几个月'],
    ['找到一份能一直做东西、又留得住清晨的工作。', '长期愿望', '几年内'],
  ],
};

const hide = (p) => p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
const mk = (b, lang, mobile) => b.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile,
  locale: lang === 'en' ? 'en-US' : 'zh-CN',
});
const tap = async (p, re) => {
  const b = p.locator('button:visible').filter({ hasText: re }).first();
  if (!(await b.count())) return false;
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click({ force: true });               // ★生成结果的浮层会挡住「保存愿望」, 普通 click 会等到超时
  return true;
};
async function fullShot(p, name) {
  await hide(p);
  await p.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 180)); }
    window.scrollTo(0, H); await new Promise(r => setTimeout(r, 800));
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500));
  });
  await p.waitForTimeout(4500);
  await hide(p);
  await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  console.log('SAVED', name);
}

// ── 真跑 /try 生成 4 个愿望, 顺手更新夹具 ──
async function generate(p, lang) {
  for (const [text, type, time] of WISHES[lang]) {
    await p.goto(BASE + '/try', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    await p.locator('textarea:visible').first().fill(text);
    await p.waitForTimeout(300);
    await tap(p, new RegExp('^' + type + '$'));
    await tap(p, new RegExp('^' + time + '$'));
    await p.waitForTimeout(300);
    await tap(p, /Generate My Wish Image|生成我的愿望图/i);
    // ★生成时长不定, 别用固定等待 —— 等「保存」真出现
    const save = p.locator('button:visible').filter({ hasText: /Save Wish|保存愿望/ }).first();
    await save.waitFor({ state: 'visible', timeout: 90000 });
    await save.scrollIntoViewIfNeeded().catch(() => {});
    await save.click({ force: true });
    await p.waitForTimeout(2500);
  }
  const dump = await p.evaluate(() => localStorage.getItem('wishflow_wishes') || '[]');
  fs.writeFileSync(path.join(HERE, `wishes-${lang}.json`), dump);
  console.log(`[${lang}] 夹具已更新, 共`, JSON.parse(dump).length, '个愿望');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const lang of ['en', 'zh']) {
    const wishes = fs.readFileSync(path.join(HERE, `wishes-${lang}.json`), 'utf8');

    for (const mobile of [false, true]) {
      const tag = mobile ? 'm' : 'd';
      const ctx = await mk(browser, lang, mobile);
      await ctx.addInitScript(([W, regen]) => {
        try {
          // 三处首访提示气泡标记为已读, 否则每页都被挡住
          ['create', 'gallery', 'today'].forEach(k => localStorage.setItem(`wishflow_hint_${k}_v1`, '1'));
          if (!regen) localStorage.setItem('wishflow_wishes', W);
        } catch (e) {}
      }, [wishes, REGEN]);
      const p = await ctx.newPage();

      // ★语言不能 seed wishflow_settings —— 那个不生效, 必须点导航里那颗切换钮
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p.waitForTimeout(1000);
      if (lang === 'zh') { await tap(p, /^中文$/); await p.waitForTimeout(1300); }

      if (REGEN && !mobile) await generate(p, lang);

      for (const [name, route] of PAGES) {
        try {
          await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 40000 });
          await p.waitForTimeout(1600);
          await fullShot(p, `${tag}-${name}-${lang}`);
        } catch (e) { console.log('FAIL', name, tag, lang, e.message.slice(0, 70)); }
      }

      // ── 愿望库三视图 ──
      for (const mode of Object.keys(VIEWS)) {
        try {
          await p.goto(BASE + '/wishes', { waitUntil: 'networkidle' });
          await p.waitForTimeout(2000);
          const byText = p.locator('[data-onboard="views"] button').filter({ hasText: new RegExp('^' + VIEWS[mode][lang] + '$') }).first();
          // 窄屏按钮只剩图标(文字在 ≤700px 隐藏), 文字匹配不到就按 aria-label
          const btn = (await byText.count()) ? byText
            : p.locator(`[data-onboard="views"] button[aria-label="${VIEWS[mode][lang]}"]`).first();
          await btn.click({ force: true });
          await p.waitForTimeout(3500);
          const map = p.locator('[class*="mapFullBleed"]').first();

          if (!mobile && mode !== 'board' && await map.count()) {
            // ★星系/河流是全幅画布, 页面几乎滚不动, 工具条永远卡在顶上。
            //   直接 map.screenshot() 又会把浮在上面的 sticky 导航拍进去 ——
            //   先把它错到导航下面, 再按它的框 clip 视口图。
            await map.scrollIntoViewIfNeeded();
            await p.evaluate(() => {
              const nav = document.querySelector('header, nav');
              window.scrollBy(0, -((nav ? nav.getBoundingClientRect().height : 0) + 12));
            });
            await p.waitForTimeout(900);
            const box = await map.boundingBox();
            const vs = p.viewportSize();
            await hide(p);
            await p.screenshot({
              path: path.join(OUT, `d-wishes-${mode}-${lang}.png`),
              clip: box && {
                x: Math.max(0, box.x), y: Math.max(0, box.y),
                width: Math.min(box.width, vs.width - Math.max(0, box.x)),
                height: Math.min(box.height, vs.height - Math.max(0, box.y)),
              },
            });
          } else {
            // 手机卡要竖构图, 裁出来的横带塞进机身框会被切 —— 用完整视口图
            if (mobile && mode !== 'board' && await map.count()) {
              await map.scrollIntoViewIfNeeded();
              await p.evaluate(() => {
                const el = document.querySelector('[class*="mapFullBleed"]');
                const nav = document.querySelector('header, nav');
                if (!el) return;
                const navH = nav ? nav.getBoundingClientRect().height : 0;
                const r = el.getBoundingClientRect();
                window.scrollBy(0, r.top - navH - Math.max(0, (window.innerHeight - navH - r.height) / 2));
              });
              await p.waitForTimeout(900);
            }
            await hide(p);
            await p.screenshot({ path: path.join(OUT, `${tag}-wishes-${mode}-${lang}.png`) });
          }
          console.log('SAVED', `${tag}-wishes-${mode}-${lang}`);
        } catch (e) { console.log('FAIL', mode, tag, lang, e.message.slice(0, 70)); }
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log('DONE →', OUT);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
