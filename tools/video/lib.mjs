import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const CLIPS = join(ROOT, 'clips');
export const ASSETS = join(ROOT, 'assets');
const MANIFEST = join(CLIPS, 'manifest.json');
mkdirSync(CLIPS, { recursive: true });

export const W = 1920;
export const H = 1080;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dataUrl = (file) => {
  const ext = file.split('.').pop().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${readFileSync(join(ASSETS, file)).toString('base64')}`;
};
export const STICKERS = Object.fromEntries(
  ['computer-cat.png', 'thumbs-cat.png', 'shrug-cat.png', 'glasses-cat.png', 'hacker-cat.png', 'lock-in.png', 'duck.png']
    .map((f) => [f.replace(/\.(png|jpg)$/, ''), dataUrl(f)]),
);

// Injected into every page: comic caption bubbles, reaction stickers, a visible cursor and highlight rings.
const OVERLAY = () => {
  if (window.__fx) return;
  const css = `
  .fx-root{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:'Roboto Mono',ui-monospace,monospace}
  .fx-cursor{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(76,157,176,.35);border:3px solid #2E7A8C;box-shadow:0 0 0 6px rgba(255,255,255,.55);transition:transform .12s ease,background .12s}
  .fx-cursor.down{transform:scale(.7);background:rgba(255,189,197,.8)}
  .fx-bubble-wrap,.fx-sticker,.fx-chip{zoom:var(--fx-k,1)}
  .fx-bubble-wrap{position:fixed;left:56px;bottom:64px;max-width:1040px;transform-origin:left bottom}
  .fx-tag{display:inline-block;margin:0 0 -6px 18px;padding:6px 16px;border:3px solid #1B1A24;border-radius:12px;font-weight:800;font-size:20px;letter-spacing:.12em;text-transform:uppercase;transform:rotate(-3deg);position:relative;z-index:2;box-shadow:4px 4px 0 #1B1A24}
  .fx-bubble{position:relative;background:#fff;color:#1B1A24;border:4px solid #1B1A24;border-radius:26px;padding:20px 30px 22px 26px;font-weight:700;font-size:31px;line-height:1.32;box-shadow:10px 10px 0 #1B1A24;transform:rotate(-1.2deg);display:flex;gap:18px;align-items:flex-start}
  .fx-bubble:after{content:'';position:absolute;left:64px;bottom:-26px;width:34px;height:34px;background:#fff;border-right:4px solid #1B1A24;border-bottom:4px solid #1B1A24;transform:rotate(45deg) skew(10deg,10deg)}
  .fx-emoji{font-size:46px;line-height:1;animation:fxWobble 1.6s ease-in-out infinite;font-family:'Apple Color Emoji',sans-serif}
  .fx-word{display:inline-block;opacity:0;transform:translateY(18px) scale(.6) rotate(-6deg);animation:fxWord .42s cubic-bezier(.2,1.6,.4,1) forwards;margin-right:.32em}
  .fx-word.hl{background:linear-gradient(transparent 55%,var(--fx-accent) 55%);padding:0 2px}
  .fx-in{animation:fxPop .55s cubic-bezier(.2,1.5,.4,1) both}
  .fx-out{animation:fxOut .35s ease-in both}
  .fx-sticker{position:fixed;width:230px;padding:10px;background:#fff;border:4px solid #1B1A24;border-radius:24px;box-shadow:8px 8px 0 #1B1A24;animation:fxSticker .7s cubic-bezier(.2,1.6,.4,1) both}
  .fx-sticker img{width:100%;display:block;border-radius:14px}
  .fx-sticker.out{animation:fxOut .35s ease-in both}
  .fx-ring{position:fixed;border:5px solid #FFBDC5;border-radius:16px;box-shadow:0 0 0 4px #1B1A24,0 0 30px rgba(255,189,197,.9);animation:fxRing 1.1s ease-in-out infinite}
  .fx-chip{position:fixed;right:44px;bottom:40px;padding:10px 18px;background:#1B1A24;color:#FFBDC5;border-radius:999px;font-weight:800;font-size:20px;letter-spacing:.08em;animation:fxPop .5s both}
  @keyframes fxPop{0%{opacity:0;transform:scale(.4) rotate(-8deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes fxOut{to{opacity:0;transform:scale(.6) translateY(30px) rotate(6deg)}}
  @keyframes fxWord{to{opacity:1;transform:none}}
  @keyframes fxWobble{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(12deg) scale(1.12)}}
  @keyframes fxSticker{0%{opacity:0;transform:scale(.2) rotate(-25deg)}70%{transform:scale(1.08) rotate(6deg)}100%{opacity:1;transform:scale(1) rotate(var(--fx-rot,4deg))}}
  @keyframes fxRing{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.03);opacity:.75}}`;
  const ready = () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'fx-root';
    root.style.setProperty('--fx-k', String(innerWidth / 1920));
    document.body.appendChild(root);
    const cursor = document.createElement('div');
    cursor.className = 'fx-cursor';
    cursor.style.left = '-50px';
    root.appendChild(cursor);
    addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cursor.classList.add('down'), true);
    addEventListener('mouseup', () => cursor.classList.remove('down'), true);
    window.__fx = { root };
  };
  if (document.body) ready(); else addEventListener('DOMContentLoaded', ready);
};

export async function launch() {
  return chromium.launch({ channel: 'chrome', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
}

let CURRENT = null;
export function cue() {
  CURRENT.marks.cues.push((Date.now() - CURRENT.t0) / 1000);
}

export async function scene(browser, name, fn, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: CLIPS, size: opts.viewport || { width: W, height: H } },
    colorScheme: opts.dark ? 'dark' : 'light',
    extraHTTPHeaders: opts.headers,
  });
  await context.addInitScript(OVERLAY);
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  const t0 = Date.now();
  const marks = { start: 0, speed: [], cut: [], cues: [] };
  CURRENT = { marks, t0 };
  const api = {
    page,
    mark() { marks.start = (Date.now() - t0) / 1000; },
    async fast(factor, body) {
      const from = (Date.now() - t0) / 1000;
      await body();
      marks.speed.push({ from, to: (Date.now() - t0) / 1000, factor });
    },
    async cutOut(body) {
      const from = (Date.now() - t0) / 1000;
      await body();
      marks.cut.push({ from, to: (Date.now() - t0) / 1000 });
    },
  };
  try {
    await fn(api);
  } finally {
    const video = page.video();
    await context.close();
    const out = join(CLIPS, `${name}.webm`);
    renameSync(await video.path(), out);
    const end = (Date.now() - t0) / 1000;
    const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
    manifest[name] = { file: `${name}.webm`, ...marks, end };
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`recorded ${name} (${end.toFixed(1)}s)`);
  }
}

export async function settle(page) {
  await page.waitForFunction(() => !!window.__fx, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
}

// A comic speech bubble with a tag, a wobbling emoji and words that pop in one by one.
export async function say(page, { tag, text, emoji = '✨', color = '#FFBDC5', hold = 3500, highlight = [] }) {
  await settle(page);
  await page.evaluate(({ tag, text, emoji, color, highlight }) => {
    const root = window.__fx.root;
    root.querySelectorAll('.fx-bubble-wrap').forEach((n) => n.remove());
    const wrap = document.createElement('div');
    wrap.className = 'fx-bubble-wrap fx-in';
    wrap.style.setProperty('--fx-accent', color);
    if (tag) {
      const t = document.createElement('div');
      t.className = 'fx-tag';
      t.style.background = color;
      t.textContent = tag;
      wrap.appendChild(t);
    }
    const b = document.createElement('div');
    b.className = 'fx-bubble';
    const e = document.createElement('div');
    e.className = 'fx-emoji';
    e.textContent = emoji;
    const body = document.createElement('div');
    text.split(' ').forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'fx-word' + (highlight.includes(w.replace(/[.,!?:]/g, '')) ? ' hl' : '');
      s.textContent = w;
      s.style.animationDelay = `${0.25 + i * 0.07}s`;
      body.appendChild(s);
    });
    b.append(e, body);
    wrap.appendChild(b);
    root.appendChild(wrap);
  }, { tag, text, emoji, color, highlight });
  await sleep(hold);
}

export async function unsay(page) {
  await page.evaluate(() => {
    window.__fx?.root.querySelectorAll('.fx-bubble-wrap').forEach((n) => { n.classList.add('fx-out'); setTimeout(() => n.remove(), 400); });
  });
  await sleep(400);
}

export async function sticker(page, key, { x = 1620, y = 60, rot = 5, hold = 2500, size = 230 } = {}) {
  await settle(page);
  await page.evaluate(({ src, x, y, rot, size }) => {
    const d = document.createElement('div');
    d.className = 'fx-sticker';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.width = size + 'px';
    d.style.setProperty('--fx-rot', rot + 'deg');
    d.innerHTML = `<img src="${src}">`;
    d.dataset.fx = 'sticker';
    window.__fx.root.appendChild(d);
  }, { src: STICKERS[key], x, y, rot, size });
  await sleep(hold);
  await page.evaluate(() => window.__fx.root.querySelectorAll('[data-fx=sticker]').forEach((n) => { n.classList.add('out'); setTimeout(() => n.remove(), 400); }));
}

export async function chip(page, text) {
  await settle(page);
  await page.evaluate((text) => {
    window.__fx.root.querySelectorAll('.fx-chip').forEach((n) => n.remove());
    const c = document.createElement('div');
    c.className = 'fx-chip';
    c.textContent = text;
    window.__fx.root.appendChild(c);
  }, text);
}

export async function ring(page, locator, hold = 1800, pad = 8) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ box, pad }) => {
    const r = document.createElement('div');
    r.className = 'fx-ring';
    Object.assign(r.style, { left: box.x - pad + 'px', top: box.y - pad + 'px', width: box.width + 2 * pad + 'px', height: box.height + 2 * pad + 'px' });
    r.dataset.fx = 'ring';
    window.__fx.root.appendChild(r);
  }, { box, pad });
  await sleep(hold);
  await page.evaluate(() => window.__fx.root.querySelectorAll('[data-fx=ring]').forEach((n) => n.remove()));
}

let mouse = { x: W / 2, y: H / 2 };
export async function moveTo(page, locator, steps = 28) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to move to');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(mouse.x, mouse.y);
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}

export async function click(page, locator, pause = 500) {
  await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
  await moveTo(page, locator);
  await sleep(250);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(pause);
}

export async function smoothScroll(page, dy, ms = 1800) {
  const steps = Math.max(1, Math.round(ms / 30));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(30);
  }
}

// Types a command into the ttyd terminal and waits for the prompt to come back.
export async function run(page, cmd, { timeout = 120000, after = 1500, typeDelay = 38 } = {}) {
  await page.keyboard.type(cmd, { delay: typeDelay });
  await sleep(300);
  const before = await page.evaluate(() => window.__promptCount || 0);
  await page.keyboard.press('Enter');
  await page.waitForFunction((before) => (window.__promptCount || 0) > before, before, { timeout });
  await sleep(after);
}
