// Render artcompare2.json as a side-by-side HTML gallery for eyeballing.
// Run: node scripts/artgallery2.mjs [outPath]
import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./artcompare2.json', import.meta.url), 'utf8'));
const outPath = process.argv[2] || new URL('./artcompare2.html', import.meta.url).pathname;

const COLS = [
  ['B', '单发 · gemini-3-flash（只换画手）'],
  ['C', '场景规划 → gemini-3-flash（规划后再画）'],
];

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const cell = r => {
  const svg = r.svg
    ? r.svg.replace(/<svg /i, '<svg style="width:100%;height:auto;display:block" ')
    : '<div style="padding:40px 0;text-align:center;color:#a04040;font-size:13px">（未产出 SVG）</div>';
  return `<td><div class="frame">${svg}</div></td>`;
};

const rows = Object.values(data).map(w => `
  <tr>
    <td class="wishCell">
      <h3>${esc(w.label)}</h3>
      <p class="wishText">${esc(w.wish)}</p>
      <details open><summary>场景规划 (C 用)</summary><pre>${esc(JSON.stringify(w.spec, null, 2))}</pre></details>
    </td>
    ${cell(w.B)}${cell(w.C)}
  </tr>`).join('\n');

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>愿望画质量对比</title>
<style>
  body { font-family: ui-sans-serif, system-ui; background: #faf9f7; color: #2e2b33; margin: 24px; }
  h1 { font-size: 22px; } .sub { color: #4a5568; font-size: 13px; margin-bottom: 16px; }
  table { border-collapse: separate; border-spacing: 10px; width: 100%; }
  th { font-size: 13px; color: #5e4e8c; text-align: left; padding: 0 4px; }
  td { vertical-align: top; background: #fff; border: 1px solid rgba(214,206,233,.8); border-radius: 14px; padding: 10px; width: 37%; }
  .wishCell { background: transparent; border: none; width: 20%; min-width: 170px; }
  .wishCell h3 { margin: 0 0 6px; font-size: 15px; }
  .wishText { font-size: 12px; color: #4a5568; line-height: 1.5; }
  .frame { background: #faf9f7; border-radius: 8px; padding: 6px; }
  details { font-size: 11px; margin-top: 6px; } pre { font-size: 10px; white-space: pre-wrap; }
</style></head><body>
<h1>愿望画「词不达意」对比 · gemini-3-flash</h1>
<p class="sub">左：现有 prompt 直接画。右：先用 3.1-flash-lite 规划场景（主角/标志物/禁画的偷懒画法），再按规划画。</p>
<table>
<tr><th></th>${COLS.map(([k, t]) => `<th>${k} · ${t}</th>`).join('')}</tr>
${rows}
</table>
</body></html>`;

writeFileSync(outPath, html);
console.log('gallery ->', outPath);
