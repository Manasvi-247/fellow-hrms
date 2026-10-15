// Records every scene of the Fellow demo video as its own clip. Usage: node record.mjs [scene ...]
import { execSync } from 'node:child_process';
import {
  launch, scene, say, unsay, sticker, chip, ring, click, moveTo, smoothScroll, run, sleep,
} from './lib.mjs';

const REPO = 'https://github.com/Manasvi-247/fellow-hrms';
const APP = 'http://fellow.localhost';
const READ = { viewport: { width: 1280, height: 720 } };
const APPVIEW = { viewport: { width: 1440, height: 810 } };
const nav = (page, name) => page.locator('aside[aria-label="Main navigation"]').getByRole('button', { name, exact: true });
const page_ = (file, params) => new URL(`./pages/${file}?${new URLSearchParams(params)}`, import.meta.url).href;
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const COUNT_PROMPTS = () => {
  const start = () => {
    let last = document.title;
    window.__promptCount = 0;
    new MutationObserver(() => {
      if (document.title !== last && document.title.startsWith('prompt-')) window.__promptCount++;
      last = document.title;
    }).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
    const style = document.createElement('style');
    style.textContent = 'html,body{background:#14121A!important}#terminal-container{position:absolute!important;inset:48px 64px 300px 64px!important;width:auto!important;height:auto!important}.fx-cursor{display:none!important}';
    document.head.appendChild(style);
    setTimeout(() => dispatchEvent(new Event('resize')), 200);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
};

async function card(browser, name, params, ms = 4500) {
  await scene(browser, name, async ({ page, mark }) => {
    await page.goto(page_('card.html', params));
    mark();
    await sleep(ms);
  });
}

async function slides(browser, name, list, per = 5200) {
  await scene(browser, name, async ({ page, mark }) => {
    await page.goto(page_('slides.html', { s: list.join(','), d: per }));
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    mark();
    for (let i = 0; i < list.length; i++) {
      await page.evaluate((i) => window.show(i), i);
      await sleep(per);
    }
  });
}

async function terminal(browser, name, body) {
  await scene(browser, name, async (api) => {
    const { page } = api;
    await page.goto('http://127.0.0.1:7681/');
    await page.waitForSelector('.xterm');
    await page.evaluate(COUNT_PROMPTS);
    await sleep(1200);
    await page.click('.xterm');
    await page.keyboard.press('Control+L');
    await sleep(600);
    api.mark();
    await body(api);
    await sleep(800);
  });
}

const SCENES = {
  async intro(b) {
    await card(b, 'intro', { title: 'Fellow', sub: 'an HR app, shipped the DevOps way', pill: 'DevOps capstone · Manasvi Sabbarwal', img: 'lock-in', color: '#C69FD5' }, 6000);
  },

  async 'slides-open'(b) {
    await slides(b, 'slides-open', [1, 2, 3, 4]);
  },

  async 'card-app'(b) {
    await card(b, 'card-app', { n: '01', title: 'The app', sub: 'Real data from FastAPI and PostgreSQL. Nothing mocked.', pill: 'React + Vite', img: 'computer-cat', color: '#FFBDC5' });
  },

  async 'app-tour'(b) {
    await scene(b, 'app-tour', async ({ page, mark }) => {
      await page.addInitScript(() => { try { localStorage.setItem('fellow-theme', 'light'); localStorage.removeItem('fellow-sidebar'); } catch {} });
      await page.goto(`${APP}/`);
      await page.waitForLoadState('load'); await sleep(1500);
      await chip(page, '01 · THE APP');
      mark();
      await say(page, { tag: 'Dashboard', text: 'Who is in, who is out, and what needs approving. Real data, straight from the API.', emoji: '👋', highlight: ['Real'], hold: 4200 });
      await ring(page, page.getByText('Pending requests').first(), 1600, 40);
      await unsay(page);
      await click(page, page.getByRole('button', { name: /collapse sidebar/i }), 900);
      await say(page, { tag: 'Bonus', text: 'Collapsible sidebar, because screen space is precious.', emoji: '🪄', hold: 2600 });
      await click(page, page.getByRole('button', { name: /expand sidebar/i }), 700);
      await unsay(page);

      await click(page, nav(page, 'Employees'), 1200);
      await say(page, { tag: 'Employees', text: 'Search, filter and real URLs like /employees/12.', emoji: '🔎', highlight: ['/employees/12.'], hold: 1500 });
      const search = page.getByRole('textbox', { name: 'Filter employees' });
      await click(page, search, 300);
      await page.keyboard.type('Karan', { delay: 110 });
      await sleep(1600);
      await click(page, page.getByText('Karan Shah').first(), 1800);
      await unsay(page);
      for (const tab of ['Leave', 'Attendance']) {
        await click(page, page.locator('main button, main [role=tab]').filter({ hasText: new RegExp(`^\\s*${tab}\\s*$`) }).first(), 1800);
      }
      await sticker(page, 'glasses-cat', { x: 1600, y: 120, hold: 1800, size: 220 });

      await click(page, nav(page, 'Leave').or(page.locator('aside[aria-label="Main navigation"]').getByRole('button', { name: /Leave/ })).first(), 1200);
      const approvals = page.locator('main').getByRole('button', { name: /approvals/i }).first();
      if (await approvals.count()) await click(page, approvals, 1200);
      await say(page, { tag: 'Leave', text: 'Managers approve or reject. Balances update, weekends and holidays never count.', emoji: '🌴', highlight: ['approve', 'reject.'], hold: 2200 });
      const approve = page.getByRole('button', { name: /^approve$/i }).first();
      if (await approve.count()) {
        await click(page, approve, 1200);
        const confirm = page.getByRole('dialog').getByRole('button', { name: /approve/i });
        if (await confirm.count()) await click(page, confirm.first(), 1500);
      }
      await sleep(1200);
      await unsay(page);

      await click(page, nav(page, 'Attendance'), 1500);
      await say(page, { tag: 'Attendance', text: 'It is the middle of the night, so nobody is in yet. Let us be the first.', emoji: '🦉', highlight: ['first.'], hold: 2600 });
      const checkIn = page.getByRole('button', { name: /check in/i }).first();
      if (await checkIn.count()) await click(page, checkIn, 2200);
      await say(page, { tag: 'Server time', text: 'The time comes from the server, so nobody can fake it. Late after 09:30.', emoji: '⏰', highlight: ['server,'], hold: 3600 });
      await unsay(page);
      const theme = page.getByRole('button', { name: /dark|theme/i }).first();
      if (await theme.count()) await click(page, theme, 1200);
      await say(page, { tag: 'Dark mode', text: 'And yes, there is a dark mode.', emoji: '🌙', hold: 2600 });
    }, APPVIEW);
  },

  async 'slides-arch'(b) {
    await slides(b, 'slides-arch', [5], 6500);
  },

  async 'card-code'(b) {
    await card(b, 'card-code', { n: '02', title: 'Codebase', sub: 'One repo: app, pipeline, infra and docs.', pill: 'github.com/Manasvi-247/fellow-hrms', img: 'shrug-cat', color: '#C69FD5' });
  },

  async codebase(b) {
    await scene(b, 'codebase', async ({ page, mark }) => {
      const open = async (name, pause = 1600) => {
        const link = page.locator('table[aria-labelledby=folders-and-files] a, [aria-labelledby=folders-and-files] a').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`) }).filter({ visible: true }).first();
        await click(page, link, 300);
        await page.waitForLoadState('load');
        await sleep(pause);
      };
      const home = async () => {
        await click(page, page.getByRole('link', { name: 'fellow-hrms', exact: true }).first(), 300);
        await page.waitForLoadState('load');
        await sleep(1200);
      };
      await page.goto(REPO);
      await page.waitForLoadState('load');
      await sleep(1500);
      await chip(page, '02 · CODEBASE');
      mark();
      await say(page, { tag: 'Repo tour', text: 'backend, frontend, terraform, helm, argocd, monitoring. Everything as code.', emoji: '🗂️', highlight: ['code.'], hold: 3600 });
      await unsay(page);
      await open('backend', 900);
      await open('app', 900);
      await open('routers', 900);
      await say(page, { tag: 'Backend', text: 'FastAPI routers: one file per resource, 26 endpoints in total.', emoji: '🐍', hold: 2600 });
      await open('leaves.py', 1200);
      await unsay(page);
      await smoothScroll(page, 600, 2200);
      await sleep(1000);
      await home();
      await open('.github/workflows', 900);
      await open('ci-cd.yml', 1200);
      await say(page, { tag: 'Pipeline', text: 'The CI/CD workflow: test, build, scan, push, promote.', emoji: '⚙️', hold: 2200 });
      await smoothScroll(page, 1100, 3000);
      await unsay(page);
      await home();
      await open('helm/fellow', 900);
      await open('templates', 1200);
      await say(page, { tag: 'Helm', text: 'The Helm chart: deployments, ingress, HPA, ServiceMonitor, Grafana dashboard.', emoji: '⛵', hold: 3800 });
    }, READ);
  },

  async 'card-ci'(b) {
    await card(b, 'card-ci', { n: '03', title: 'CI/CD', sub: 'Push once, ship safely.', pill: 'GitHub Actions · Trivy · GHCR', img: 'thumbs-cat', color: '#F2C14E' });
  },

  async 'slides-ci'(b) {
    await slides(b, 'slides-ci', [6], 6500);
  },

  async 'ci-push'(b) {
    await terminal(b, 'ci-push', async ({ page }) => {
      await say(page, { tag: 'Live push', text: 'A real change to the tool recording this video, committed and pushed to main.', emoji: '🚀', hold: 1500 });
      await run(page, 'git status --short');
      await run(page, 'git add tools/video && git commit -m "fix(tools): record demo scenes at readable sizes"');
      await run(page, 'git pull --rebase --autostash -q origin main && git push origin main', { after: 2500 });
      await unsay(page);
    });
  },

  async 'ci-run'(b) {
    const sha = sh('git rev-parse HEAD');
    const runId = sh(`gh run list --commit ${sha} --limit 1 --json databaseId --jq '.[0].databaseId'`);
    await scene(b, 'ci-run', async ({ page, mark, fast }) => {
      await page.goto(`${REPO}/actions/runs/${runId}`);
      await page.waitForLoadState('domcontentloaded');
      await chip(page, '03 · CI/CD');
      mark();
      await say(page, { tag: 'Pipeline', text: 'Tests and the frontend build run first. Broken code never becomes an image.', emoji: '🧪', highlight: ['first.'], hold: 3500 });
      await fast(8, async () => {
        for (let i = 0; i < 60; i++) {
          const status = sh(`gh run view ${runId} --json status --jq .status`);
          if (status === 'completed') break;
          await sleep(5000);
          if (i % 3 === 2) await page.reload({ waitUntil: 'domcontentloaded' });
        }
      });
      await page.reload({ waitUntil: 'networkidle' });
      await say(page, { tag: 'All green', text: '5 out of 5 jobs passed. Trivy found 0 HIGH or CRITICAL vulnerabilities.', emoji: '✅', highlight: ['0'], hold: 2000 });
      await sticker(page, 'thumbs-cat', { x: 1580, y: 150, hold: 2200 });
      await unsay(page);
      await smoothScroll(page, 900, 2400);
      await say(page, { tag: 'Trivy', text: 'Scan results are attached to every run.', emoji: '🛡️', hold: 3000 });
      await unsay(page);
      await page.goto(`${REPO}/commits/main`);
      await page.waitForLoadState('load'); await sleep(1500);
      await say(page, { tag: 'GitOps', text: 'CI then commits the new image tag to Git for staging.', emoji: '🤖', highlight: ['Git'], hold: 3800 });
      await page.goto('https://github.com/Manasvi-247?tab=packages');
      await page.waitForLoadState('load'); await sleep(1500);
      await say(page, { tag: 'GHCR', text: 'Both images live in GitHub Container Registry, tagged with the commit SHA.', emoji: '📦', highlight: ['SHA.'], hold: 3800 });
    }, READ);
  },

  async 'argocd'(b) {
    const pw = sh("kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d");
    await scene(b, 'argocd', async ({ page, mark }) => {
      await page.goto('http://argocd.localhost/login');
      await page.waitForSelector('input[name=username], #username');
      await page.fill('input[name=username], #username', 'admin');
      await page.fill('input[name=password], #password', pw);
      await page.keyboard.press('Enter');
      await page.waitForURL(/applications/);
      await page.goto('http://argocd.localhost/applications/argocd/fellow-staging?view=tree');
      await page.waitForLoadState('load'); await sleep(1500);
      await sleep(2500);
      await chip(page, '04 · GITOPS');
      mark();
      await say(page, { tag: 'Argo CD', text: 'Argo CD watches Git and syncs staging to the new commit. Synced and Healthy.', emoji: '🐙', highlight: ['Synced', 'Healthy.'], hold: 4500 });
      const refresh = page.getByRole('button', { name: /refresh/i }).first();
      if (await refresh.count()) await click(page, refresh, 2500);
      await unsay(page);
      await smoothScroll(page, 500, 1500);
      await sticker(page, 'computer-cat', { x: 1600, y: 140, hold: 2200 });
      await say(page, { tag: 'Self-heal', text: 'Change something by hand and Argo CD puts it back. Git wins.', emoji: '🔁', highlight: ['Git', 'wins.'], hold: 3800 });
    }, READ);
  },

  async 'card-tf'(b) {
    await card(b, 'card-tf', { n: '05', title: 'Terraform', sub: 'VPC, subnets, NAT, EKS and the kind cluster, all as code.', pill: 'LocalStack · ap-south-1', img: 'glasses-cat', color: '#FFBDC5' });
  },

  async 'slides-tf'(b) {
    await slides(b, 'slides-tf', [7], 6500);
  },

  async terraform(b) {
    await terminal(b, 'terraform', async ({ page, fast }) => {
      await say(page, { tag: 'Terraform', text: 'Plan first. Reading the plan is a whole personality.', emoji: '🧐', hold: 1200 });
      await run(page, 'cd terraform && terraform plan -no-color | tail -n 12', { timeout: 180000, after: 3500 });
      await unsay(page);
      await page.keyboard.press('Control+L');
      await run(page, 'terraform output', { after: 3000 });
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'LocalStack', text: 'The VPC and subnets really exist, inside LocalStack. No AWS bill.', emoji: '☁️', hold: 1200 });
      await run(page, "awsl ec2 describe-subnets --filters Name=tag:Project,Values=fellow --query 'Subnets[].[Tags[?Key==`Name`]|[0].Value,CidrBlock,AvailabilityZone]' --output table", { after: 4000 });
      await unsay(page);
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'EKS', text: 'Flip one variable and the same code plans a real EKS cluster.', emoji: '🔀', hold: 1000 });
      await run(page, 'terraform plan -no-color -var create_eks=true | grep -E "eks|Plan:"', { timeout: 180000, after: 4000 });
      await run(page, 'cd ..', { after: 300 });
    });
  },

  async 'card-k8s'(b) {
    await card(b, 'card-k8s', { n: '06', title: 'Kubernetes', sub: 'Helm, ingress and an autoscaler that actually scales.', pill: 'kind · Helm · HPA', img: 'shrug-cat', color: '#4C9DB0' });
  },

  async 'slides-k8s'(b) {
    await slides(b, 'slides-k8s', [8], 6500);
  },

  async kubernetes(b) {
    await terminal(b, 'kubernetes', async ({ page, fast }) => {
      await say(page, { tag: 'Cluster', text: 'Three nodes, created by Terraform.', emoji: '🖥️', hold: 800 });
      await run(page, 'kubectl get nodes', { after: 2500 });
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'Workloads', text: 'Pods, ClusterIP services, the ingress and the HPA.', emoji: '🐳', hold: 800 });
      await run(page, 'kubectl get pods,svc,ingress,hpa -n fellow', { after: 4500 });
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'Helm', text: 'Every release, managed by Helm.', emoji: '⛵', hold: 800 });
      await run(page, 'helm list -A', { after: 3500 });
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'Load test', text: 'Now let us stress it and watch the HPA go from 2 pods to 6.', emoji: '🔥', highlight: ['2', '6.'], hold: 800 });
      await fast(6, async () => {
        await run(page, 'WORKERS=6 DURATION=120 ./scripts/load-test.sh 2>/dev/null | cut -c1-90', { timeout: 300000, after: 1500 });
      });
      await unsay(page);
      await run(page, 'kubectl get hpa,deploy fellow-backend -n fellow', { after: 4000 });
      await sticker(page, 'lock-in', { x: 1480, y: 70, hold: 2600, size: 360, rot: -4 });
    });
  },

  async 'card-obs'(b) {
    await card(b, 'card-obs', { n: '07', title: 'Observability', sub: 'You cannot fix what you cannot see.', pill: 'Prometheus · Grafana', img: 'hacker-cat', color: '#C69FD5' });
  },

  async 'slides-obs'(b) {
    await slides(b, 'slides-obs', [9], 6000);
  },

  async observability(b) {
    const pw = sh("kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d");
    const auth = 'Basic ' + Buffer.from(`admin:${pw}`).toString('base64');
    await scene(b, 'observability', async ({ page, mark }) => {
      await page.goto('http://prometheus.localhost/targets?pool=serviceMonitor%2Ffellow%2Ffellow-backend%2F0');
      await page.waitForLoadState('load');
      await sleep(2500);
      await chip(page, '07 · OBSERVABILITY');
      mark();
      await say(page, { tag: 'Prometheus', text: 'Prometheus scrapes /metrics on every backend pod. All targets UP.', emoji: '📡', highlight: ['UP.'], hold: 4200 });
      await unsay(page);
      await page.setExtraHTTPHeaders({ Authorization: auth });
      await page.goto('http://grafana.localhost/d/fellow-backend/fellow-backend-api?orgId=1&from=now-15m&to=now&kiosk&refresh=5s');
      await page.waitForLoadState('load'); await sleep(1500);
      await sleep(4000);
      await say(page, { tag: 'Grafana', text: 'Requests, errors, latency, CPU and the HPA scaling, live from the load test.', emoji: '📈', highlight: ['live'], hold: 4500 });
      await sticker(page, 'hacker-cat', { x: 1590, y: 690, hold: 2600 });
      await unsay(page);
      await smoothScroll(page, 500, 1800);
      await say(page, { tag: 'HPA', text: 'There it is: replicas climbing, then settling back down.', emoji: '📊', hold: 4500 });
    }, READ);
  },

  async 'card-ts'(b) {
    await card(b, 'card-ts', { n: '08', title: 'Troubleshooting', sub: 'Break it on purpose, then fix it live.', pill: 'ImagePullBackOff · empty endpoints', img: 'duck', color: '#FFBDC5' });
  },

  async 'slides-ts'(b) {
    await slides(b, 'slides-ts', [10], 6000);
  },

  async troubleshooting(b) {
    await terminal(b, 'troubleshooting', async ({ page }) => {
      await say(page, { tag: 'Lab 1', text: 'Deploy an image tag that does not exist.', emoji: '🙃', hold: 800 });
      await run(page, 'kubectl apply -f troubleshooting/broken-image.yaml && sleep 12 && kubectl get pods -n fellow -l app=fellow-broken-image', { after: 2500 });
      await say(page, { tag: 'Diagnose', text: 'ImagePullBackOff. The events tell us why.', emoji: '🔍', highlight: ['ImagePullBackOff.'], hold: 800 });
      await run(page, 'kubectl get events -n fellow --field-selector reason=Failed --sort-by=.lastTimestamp | tail -n 3 | cut -c1-150', { after: 4500 });
      await page.keyboard.press('Control+L');
      await say(page, { tag: 'Lab 2', text: 'A Service whose selector matches nothing.', emoji: '🦆', hold: 800 });
      await run(page, 'kubectl apply -f troubleshooting/broken-service.yaml && kubectl get endpointslices -n fellow -l kubernetes.io/service-name=fellow-broken-service', { after: 3500 });
      await say(page, { tag: 'Fix', text: 'Point the selector at the right label and the endpoints appear.', emoji: '🔧', hold: 800 });
      await run(page, 'kubectl patch service fellow-broken-service -n fellow -p \'{"spec":{"selector":{"app.kubernetes.io/name":"backend"}}}\' && sleep 2 && kubectl get endpointslices -n fellow -l kubernetes.io/service-name=fellow-broken-service', { after: 4000 });
      await run(page, 'kubectl delete -f troubleshooting/ --wait=false', { after: 2000 });
      await unsay(page);
    });
  },

  async 'slides-end'(b) {
    await slides(b, 'slides-end', [11, 12], 6000);
  },

  async outro(b) {
    await card(b, 'outro', { title: 'Thank you', sub: 'Fellow: tested, scanned, provisioned, deployed through GitOps and monitored.', pill: 'github.com/Manasvi-247/fellow-hrms', img: 'thumbs-cat', color: '#C69FD5' }, 6500);
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(SCENES);
const browser = await launch();
try {
  for (const n of names) {
    if (!SCENES[n]) throw new Error(`unknown scene ${n}`);
    await SCENES[n](browser);
  }
} finally {
  await browser.close();
}
