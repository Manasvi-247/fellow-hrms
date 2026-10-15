// Renders each subtitle line as a 1920x108 PNG strip for the assembly step.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const OUT = join(ROOT, 'build', 'subs');
mkdirSync(OUT, { recursive: true });
const subs = JSON.parse(readFileSync(join(ROOT, 'subtitles.json'), 'utf8'));

const html = (text) => `<!doctype html><html><body style="margin:0">
<div id="s" style="width:1920px;height:108px;background:#14121A;display:flex;align-items:center;justify-content:center;
font:500 30px/1.3 -apple-system,'SF Pro Text','Helvetica Neue',Arial,sans-serif;color:#F4F1F7;text-align:center;letter-spacing:.005em">
<span style="max-width:1640px">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 108 } });
await page.setContent(html(''));
await page.locator('#s').screenshot({ path: join(OUT, 'blank.png') });
let n = 0;
for (const [scene, lines] of Object.entries(subs)) {
  for (let i = 0; i < lines.length; i++) {
    await page.setContent(html(lines[i]));
    await page.locator('#s').screenshot({ path: join(OUT, `${scene}-${i}.png`) });
    n++;
  }
}
await browser.close();
console.log(`rendered ${n} subtitle strips`);
