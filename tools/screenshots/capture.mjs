// Captures live screenshots of every service for the README, slides and demo video.
// Usage: npm run capture -- [name ...]   (no names = everything)
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
};
const grafanaPassword = sh("kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d");
const repo = 'Manasvi-247/fellow-hrms';
const app = process.env.APP_URL || 'http://fellow.localhost';
const latestRun = sh(`gh run list -R ${repo} --limit 1 --json databaseId --jq '.[0].databaseId'`);

const pages = [
  { name: 'app-dashboard', url: `${app}/`, wait: 2500 },
  { name: 'app-employees', url: `${app}/employees`, wait: 2500 },
  { name: 'app-leave', url: `${app}/leave/approvals`, wait: 2500 },
  { name: 'app-attendance', url: `${app}/attendance`, wait: 2500 },
  { name: 'app-dark', url: `${app}/`, wait: 2500, dark: true },
  { name: 'app-profile', url: `${app}/employees/12`, wait: 2500 },
  { name: 'app-mobile', url: `${app}/`, wait: 2500, mobile: true },
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

} finally {
  await browser.close();
}
