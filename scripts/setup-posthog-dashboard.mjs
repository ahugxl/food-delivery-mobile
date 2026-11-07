import { usageDashboard } from './posthog-dashboard.mjs';

const environment = process.env.POSTHOG_DASHBOARD_ENVIRONMENT || 'production';
const dashboard = usageDashboard(environment);
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(dashboard, null, 2));
} else {
  const host = new URL(process.env.POSTHOG_API_HOST || 'https://us.posthog.com');
  const project = process.env.POSTHOG_PROJECT_ID;
  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  if (host.protocol !== 'https:' || !['us.posthog.com', 'eu.posthog.com'].includes(host.hostname)
    || host.username || host.password || host.port || host.search || host.hash
    || !/^\d+$/.test(project || '') || !token?.startsWith('phx_')) {
    throw new Error('Điền POSTHOG_API_HOST, POSTHOG_PROJECT_ID và POSTHOG_PERSONAL_API_KEY trong .env.posthog.local. Khóa quản trị không được đặt trong EXPO_PUBLIC_*.');
  }
  const base = `${host.origin}/api/projects/${project}/`;
  async function request(path, method = 'GET', body) {
    const url = new URL(path, base);
    if (!url.href.startsWith(base)) throw new Error('API pagination ra ngoài project đã chọn.');
    const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`PostHog API HTTP ${response.status} (${method}). Kiểm tra project và quyền dashboard/insight read + write; không cần gửi khóa vào chat.`);
    return response.json();
  }
  async function list(path) {
    const items = [];
    for (let next = path; next;) {
      const page = await request(next);
      items.push(...page.results);
      next = page.next;
    }
    return items;
  }
  const tag = 'soopifood-usage-v1';
  const existing = (await list('dashboards/?limit=100')).find(item =>
    !item.deleted && item.name === dashboard.name && item.tags?.includes(tag));
  const board = existing || await request('dashboards/', 'POST', {
    name: dashboard.name, description: dashboard.description, pinned: true, tags: [tag],
  });
  const insights = await list(`insights/?dashboard=${board.id}&limit=100`);
  for (const insight of dashboard.insights) {
    const found = insights.find(item => !item.deleted && item.name === insight.name
      && item.tags?.includes(tag));
    if (found) { console.log(`Giữ biểu đồ đã có: ${insight.name}`); continue; }
    await request('insights/', 'POST', { ...insight, dashboards: [board.id], tags: [tag] });
    console.log(`Đã thêm: ${insight.name}`);
  }
  console.log(`Dashboard: ${host.origin}/project/${project}/dashboard/${board.id}`);
}
