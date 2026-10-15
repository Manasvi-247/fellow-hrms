// Captures live screenshots of every service for the README, slides and demo video.
// Usage: npm run capture -- [name ...]   (no names = everything)
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'docs', 'screenshots');
const termDir = join(outDir, 'terminal');
mkdirSync(outDir, { recursive: true });

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
};
const grafanaPassword = sh("kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d");
const repo = 'Manasvi-247/fellow-hrms';
const latestRun = sh(`gh run list -R ${repo} --limit 1 --json databaseId --jq '.[0].databaseId'`);

const pages = [
  { name: 'app-dashboard', url: 'http://fellow.localhost/', wait: 2500 },
  { name: 'app-employees', url: 'http://fellow.localhost/employees', wait: 2500 },
  { name: 'app-leave', url: 'http://fellow.localhost/leave', wait: 2500 },
  { name: 'app-attendance', url: 'http://fellow.localhost/attendance', wait: 2500 },
  { name: 'app-dark', url: 'http://fellow.localhost/', wait: 2500, dark: true },
  { name: 'app-mobile', url: 'http://fellow.localhost/', wait: 2500, mobile: true },
  { name: 'api-swagger', url: 'http://localhost:8000/docs', wait: 2500 },
  { name: 'api-metrics', url: 'http://localhost:8000/metrics', wait: 500, height: 900 },
  { name: 'prometheus-targets', url: 'http://prometheus.localhost/targets?pool=serviceMonitor%2Ffellow%2Ffellow-backend%2F0', wait: 3000 },
  { name: 'prometheus-query', url: 'http://prometheus.localhost/query?g0.expr=sum%20by%20(handler)%20(rate(http_requests_total%7Bnamespace%3D%22fellow%22%7D%5B1m%5D))&g0.tab=graph&g0.range_input=10m', wait: 4000 },
  {
    name: 'grafana-dashboard',
    url: 'http://grafana.localhost/d/fellow-backend/fellow-backend-api?orgId=1&from=now-30m&to=now&kiosk',
    wait: 8000,
    auth: { username: 'admin', password: grafanaPassword },
    height: 1180,
  },
  { name: 'github-actions', url: `https://github.com/${repo}/actions`, wait: 3000 },
  ...(latestRun ? [{ name: 'github-actions-run', url: `https://github.com/${repo}/actions/runs/${latestRun}`, wait: 3000 }] : []),
  { name: 'github-packages', url: `https://github.com/${repo.split('/')[0]}?tab=packages`, wait: 3000 },
];

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const terminalHtml = (title, text) => {
  const [first, ...rest] = text.split('\n');
  return `<!doctype html><html><body style="margin:0;background:#0E141B;padding:24px">
  <div id="t" style="display:inline-block;min-width:900px;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid #304252">
    <div style="background:#1D2A35;padding:10px 14px;display:flex;gap:8px;align-items:center;font:600 13px -apple-system,Segoe UI,sans-serif;color:#9BA8B2">
      <span style="width:12px;height:12px;border-radius:50%;background:#FF5F57"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#FEBC2E"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#28C840"></span>
      <span style="margin-left:10px">${escape(title)}</span></div>
    <pre style="margin:0;padding:16px 18px;background:#16212B;color:#EEF2F4;font:13px/1.5 'SF Mono',Menlo,monospace;white-space:pre"><span style="color:#6FBFD1">${escape(first)}</span>
${escape(rest.join('\n'))}</pre></div></body></html>`;
};

const only = process.argv.slice(2);
const want = (name) => only.length === 0 || only.includes(name);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const p of pages.filter((p) => want(p.name))) {
    const context = await browser.newContext({
      viewport: p.mobile ? { width: 390, height: 844 } : { width: 1440, height: p.height || 900 },
      deviceScaleFactor: 2,
      isMobile: !!p.mobile,
      colorScheme: p.dark ? 'dark' : 'light',
      extraHTTPHeaders: p.auth
        ? { Authorization: `Basic ${Buffer.from(`${p.auth.username}:${p.auth.password}`).toString('base64')}` }
        : undefined,
    });
    const page = await context.newPage();
    if (p.dark) await page.addInitScript(() => { try { localStorage.setItem('fellow-theme', 'dark'); } catch {} });
    try {
      await page.goto(p.url, { waitUntil: p.until || 'load', timeout: 30000 });
      await page.waitForTimeout(p.wait);
      await page.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: !p.height });
      console.log(`captured ${p.name}`);
    } catch (err) {
      console.log(`skipped ${p.name}: ${err.message.split('\n')[0]}`);
    }
    await context.close();
  }

  const files = readdirSync(termDir).filter((f) => f.endsWith('.txt') && want(basename(f, '.txt')));
  if (files.length) {
    const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    for (const f of files) {
      const name = basename(f, '.txt');
      await page.setContent(terminalHtml(name, readFileSync(join(termDir, f), 'utf8').trimEnd()));
      await page.locator('#t').screenshot({ path: join(outDir, `terminal-${name}.png`) });
      console.log(`captured terminal-${name}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
