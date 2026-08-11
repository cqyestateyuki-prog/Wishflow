# UI Kit 截图 SOP

产出 `public/ui-kit/`：8 屏 × 中英 × 桌面/手机，一页可切视口的界面总览。
线上同一份放在作品集站 `public/wishflow-ui-kit/`。

## 跑

```bash
npm i -D playwright && npx playwright install chromium   # 仅首次
npx next dev -p 3040                                     # 另开一个终端
node scripts/ui-kit/shoot.js                             # 种夹具 → 截图 → out/
```

改了愿望卡的渲染、或想换一批内容时才加 `--generate`：会真跑 `/try` 生成 4 个愿望并
**更新 `wishes-{en,zh}.json` 夹具**。平时不要加——那是白烧 AI 额度。

出图后压缩进 `public/ui-kit/shots/`：

```bash
# 桌面整页 1600 宽 / 手机整页 780 宽 / 手机卡片缩略 640 宽(顶部一屏)
python3 - <<'PY'
from PIL import Image
import glob, os
for f in glob.glob('scripts/ui-kit/out/*.png'):
    b = os.path.basename(f)[:-4]; im = Image.open(f).convert('RGB')
    if b.startswith('d-'):
        n = b[2:]; im.resize((1600, int(im.height*1600/im.width)), Image.LANCZOS).save(f'public/ui-kit/shots/{n}.jpg', quality=82)
    else:
        n = b[2:]
        im.resize((780, int(im.height*780/im.width)), Image.LANCZOS).save(f'public/ui-kit/shots/m-{n}.jpg', quality=82)
        h = min(1688, im.height)     # 一屏 = 844 CSS @2x
        im.crop((0,0,im.width,h)).resize((640, int(h*640/im.width)), Image.LANCZOS).save(f'public/ui-kit/shots/mt-{n}.jpg', quality=82)
PY
```

## 踩过的坑（都写进脚本注释了，勿回退）

1. **语言不能 seed `wishflow_settings`** —— 往 localStorage 塞 `language` 不生效，
   必须点导航里那颗「中文 / EN」按钮。第一版整套中文截出来全是英文界面。
2. **「保存愿望」被生成结果的浮层挡住** —— 普通 `click()` 会一直等可点击性直到 30s 超时，
   要 `{force:true}`；而且生成时长不定，**别用固定等待**，要 `waitFor` 那颗按钮出现（最长 90s）。
3. **窄屏的视图切换只剩图标** —— `Board/Galaxy/River` 的文字在 ≤700px 隐藏了，
   按文字找不到，退回按 `aria-label`。
4. **星系/河流是全幅画布** —— 页面几乎滚不动，工具条永远卡在顶上；
   直接对容器 `screenshot()` 又会把 sticky 导航一起拍进去。桌面版要先把容器错到导航下面，
   再按它的框 `clip` 视口图。手机版则相反：用完整视口图，裁出来的横带塞进机身框会被切。
5. **首访提示气泡** —— 三处 `wishflow_hint_*_v1` 要在 `addInitScript` 里标记为已读。
6. **卡片缩略图必须从顶部裁** —— `sips -c` 是**居中裁**（`--cropOffset` 不生效），
   长页面会截到中段。用 PIL 显式 `crop((0,0,w,min(1688,h)))`。

## `--noseed`（2026-08 起，推荐）

画廊空态现在会**自动展示本地化示例愿望**（`lib/sampleWishes.ts` → `getSampleWishes`），
所以不必再往 localStorage 种夹具。加 `--noseed` 跑，截出的画廊就是**线上访客真实看到的样子**
（4 张示例卡 + “Example wishes / 示例愿望” 副标题），与线上一致：

```bash
NOSEED=1 node scripts/ui-kit/shoot.js     # 或 node scripts/ui-kit/shoot.js --noseed
```

不加 `--noseed` 仍是老行为（种 `wishes-{lang}.json` 夹具）。`wishes-*.json` 现在只用于
`--generate` 重新灌样例内容时的落盘，以及 `lib/sampleWishes.ts` 的生成源
（`node scripts/gen-samples.mjs`）。

## 链接策略

公开页跳线上（`https://wishflow-ruddy.vercel.app`），画廊三视图开整页长图。
现在线上访客看到的画廊**已不是空的** —— 空态自动出示例愿望，与截图一致（用 `--noseed` 截）。

语言是客户端设置不是路由，所以中英两张卡跳的是同一个 URL，首访看到的是默认语言。
