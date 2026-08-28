export function parseMetricText(value) {
  if (!value) return null;
  const normalized = String(value).replace(/,/g, '').trim();
  const m = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*([KkMm万]?)/);
  if (!m) return null;
  let n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'k') n *= 1_000;
  else if (unit === 'm') n *= 1_000_000;
  else if (unit === '万') n *= 10_000;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function readMetric(article, testId) {
  const el = article.querySelector(`[data-testid="${testId}"]`);
  if (!el) return null;
  return parseMetricText(el.getAttribute('aria-label') || el.textContent || '');
}

function getStatusLink(article) {
  const links = [...article.querySelectorAll('a[href*="/status/"]')];
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/^\/([^/]+)\/status\/(\d+)/);
    if (m) return { href, username: m[1], statusId: m[2] };
  }
  return null;
}

function getDisplayName(article) {
  const userName = article.querySelector('[data-testid="User-Name"]');
  if (!userName) return null;
  const spans = [...userName.querySelectorAll('span')]
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  return spans.find((s) => !s.startsWith('@') && s !== '·') || null;
}

export function parseArticle(article, keyword, collectedAt = new Date()) {
  if (!(article instanceof Element)) return null;
  const status = getStatusLink(article);
  const time = article.querySelector('time[datetime]');
  if (!status || !time) return null;

  const textEl = article.querySelector('[data-testid="tweetText"]');
  const text = (textEl?.innerText || textEl?.textContent || '').trim();
  const articleText = (article.innerText || '').trim();
  const isReply = /返信先[:：]|Replying to/i.test(articleText);
  const quoted = article.querySelector('[data-testid="quoteTweet"]');
  const statusLinks = [...article.querySelectorAll('a[href*="/status/"]')]
    .map((a) => a.getAttribute('href') || '')
    .filter((href) => /\/status\/\d+/.test(href));
  const uniqueStatusLinks = new Set(statusLinks.map((href) => href.match(/\/status\/(\d+)/)?.[1]).filter(Boolean));
  const isQuote = Boolean(quoted) || uniqueStatusLinks.size > 1;

  const absoluteUrl = new URL(status.href, location.origin).href;
  const postedAt = time.getAttribute('datetime');

  return {
    statusId: status.statusId,
    username: status.username,
    displayName: getDisplayName(article),
    postedAt,
    text,
    url: absoluteUrl,
    matchedKeywords: keyword ? [keyword] : [],
    isReply,
    isQuote,
    metrics: {
      replies: readMetric(article, 'reply'),
      reposts: readMetric(article, 'retweet'),
      likes: readMetric(article, 'like'),
    },
    collectedAt: collectedAt.toISOString(),
  };
}

export function parseVisiblePosts(keyword) {
  const posts = [];
  for (const article of document.querySelectorAll('article')) {
    const parsed = parseArticle(article, keyword);
    if (parsed) posts.push(parsed);
  }
  return posts;
}
