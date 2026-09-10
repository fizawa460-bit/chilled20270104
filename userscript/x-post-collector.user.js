// ==UserScript==
// @name         X Post Collector PoC
// @namespace    https://github.com/fizawa460-bit/chilled20270104
// @version      0.1.1
// @description  Collect public X search-result posts visible in your own signed-in browser.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('xpc-panel')) return;

  const DEFAULTS = {
    username: 'yuukamiya68',
    startDate: '2016-08-01',
    endDate: '2016-09-02',
    keywords: ['子供'],
    logging: false,
    maxScrolls: 120,
    stagnantLimit: 8,
    minDelayMs: 1400,
    maxDelayMs: 3200,
  };
  const DB_NAME = 'x-post-collector';
  const DB_VERSION = 1;
  const POSTS = 'posts';
  const META = 'meta';
  let panel;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const log = (...args) => panel?.readConfig().logging && console.log('[XPC]', ...args);
  const request = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(POSTS)) db.createObjectStore(POSTS, { keyPath: 'statusId' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function setMeta(key, value) {
    const db = await openDb();
    await request(db.transaction(META, 'readwrite').objectStore(META).put({ key, value }));
    db.close();
  }
  async function getMeta(key) {
    const db = await openDb();
    const row = await request(db.transaction(META, 'readonly').objectStore(META).get(key));
    db.close();
    return row?.value ?? null;
  }
  async function getAllPosts() {
    const db = await openDb();
    const rows = await request(db.transaction(POSTS, 'readonly').objectStore(POSTS).getAll());
    db.close();
    return rows;
  }
  async function upsertPost(post) {
    const db = await openDb();
    const store = db.transaction(POSTS, 'readwrite').objectStore(POSTS);
    const existing = await request(store.get(post.statusId));
    const merged = existing
      ? { ...existing, ...post, matchedKeywords: [...new Set([...(existing.matchedKeywords || []), ...(post.matchedKeywords || [])])] }
      : post;
    await request(store.put(merged));
    db.close();
    return { duplicate: Boolean(existing), post: merged };
  }

  function parseMetricText(value) {
    if (!value) return null;
    const m = String(value).replace(/,/g, '').trim().match(/([0-9]+(?:\.[0-9]+)?)\s*([KkMm万]?)/);
    if (!m) return null;
    let n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'k') n *= 1000;
    else if (unit === 'm') n *= 1000000;
    else if (unit === '万') n *= 10000;
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  function readMetric(article, testId) {
    const el = article.querySelector(`[data-testid="${testId}"]`);
    return el ? parseMetricText(el.getAttribute('aria-label') || el.textContent || '') : null;
  }
  function getStatusLink(article) {
    for (const link of article.querySelectorAll('a[href*="/status/"]')) {
      const href = link.getAttribute('href') || '';
      const m = href.match(/^\/([^/]+)\/status\/(\d+)/);
      if (m) return { href, username: m[1], statusId: m[2] };
    }
    return null;
  }
  function getDisplayName(article) {
    const el = article.querySelector('[data-testid="User-Name"]');
    if (!el) return null;
    return [...el.querySelectorAll('span')]
      .map((s) => (s.textContent || '').trim())
      .find((s) => s && !s.startsWith('@') && s !== '·') || null;
  }
  function parseArticle(article, keyword) {
    const status = getStatusLink(article);
    const time = article.querySelector('time[datetime]');
    if (!status || !time) return null;

    const textEl = article.querySelector('[data-testid="tweetText"]');
    const text = (textEl?.innerText || textEl?.textContent || '').trim();
    const articleText = (article.innerText || '').trim();
    const isReply = /返信先[:：]|Replying to/i.test(articleText);
    const statusIds = new Set(
      [...article.querySelectorAll('a[href*="/status/"]')]
        .map((a) => (a.getAttribute('href') || '').match(/\/status\/(\d+)/)?.[1])
        .filter(Boolean),
    );

    return {
      statusId: status.statusId,
      username: status.username,
      displayName: getDisplayName(article),
      postedAt: time.getAttribute('datetime'),
      text,
      url: new URL(status.href, location.origin).href,
      matchedKeywords: [keyword],
      isReply,
      isQuote: Boolean(article.querySelector('[data-testid="quoteTweet"]')) || statusIds.size > 1,
      metrics: {
        replies: readMetric(article, 'reply'),
        reposts: readMetric(article, 'retweet'),
        likes: readMetric(article, 'like'),
      },
      collectedAt: new Date().toISOString(),
    };
  }
  const parseVisiblePosts = (keyword) =>
    [...document.querySelectorAll('article')].map((a) => parseArticle(a, keyword)).filter(Boolean);

  function buildSearchUrl(config, keyword) {
    const q = `from:${config.username} ${keyword} since:${config.startDate} until:${config.endDate}`;
    return `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`;
  }
  function statsText(state, total) {
    const keyword = state.config?.keywords?.[state.keywordIndex] || '-';
    return [
      `検索語: ${keyword}`,
      `取得件数: ${total}`,
      `重複ヒット: ${state.duplicateCount || 0}`,
      `最古投稿日: ${state.oldestDate ? state.oldestDate.slice(0, 10) : '-'}`,
      `スクロール: ${state.scrollCount || 0}`,
    ].join('\n');
  }
  async function updateStats(state) {
    panel.setStats(statsText(state, (await getAllPosts()).length));
  }

  async function collectCurrent(state) {
    const keyword = state.config.keywords[state.keywordIndex];
    let stagnant = 0;
    let duplicateCount = state.duplicateCount || 0;
    let oldest = state.oldestDate || null;

    for (let scroll = state.scrollCount || 0; scroll < state.config.maxScrolls; scroll += 1) {
      const persisted = await getMeta('run');
      if (!persisted?.running || persisted.stopRequested) {
        return { ...state, running: false, stopRequested: true, scrollCount: scroll };
      }

      let roundAdded = 0;
      for (const post of parseVisiblePosts(keyword)) {
        const result = await upsertPost(post);
        if (result.duplicate) duplicateCount += 1;
        else roundAdded += 1;
        if (post.postedAt && (!oldest || post.postedAt < oldest)) oldest = post.postedAt;
      }

      stagnant = roundAdded === 0 ? stagnant + 1 : 0;
      state = { ...state, duplicateCount, oldestDate: oldest, scrollCount: scroll + 1, running: true };
      await setMeta('run', state);
      await updateStats(state);
      log('round', { keyword, roundAdded, stagnant, scroll: scroll + 1 });

      if (oldest && oldest.slice(0, 10) < state.config.startDate) break;
      if (stagnant >= state.config.stagnantLimit) break;

      window.scrollBy({ top: Math.max(window.innerHeight * 0.9, 700), behavior: 'smooth' });
      const delay = state.config.minDelayMs + Math.random() * (state.config.maxDelayMs - state.config.minDelayMs);
      await sleep(delay);
    }
    return { ...state, scrollCount: 0, oldestDate: oldest, duplicateCount };
  }

  async function navigateForState(state) {
    const keyword = state.config.keywords[state.keywordIndex];
    const target = buildSearchUrl(state.config, keyword);
    await setMeta('run', { ...state, running: true, stopRequested: false });
    if (location.href !== target) location.href = target;
    else setTimeout(() => runPersisted(), 500);
  }

  async function runPersisted() {
    let state = await getMeta('run');
    if (!state?.running || state.stopRequested) {
      if (state) await updateStats(state);
      return;
    }
    if (state.keywordIndex >= state.config.keywords.length) {
      state = { ...state, running: false, finished: true };
      await setMeta('run', state);
      await updateStats(state);
      return;
    }

    const expected = buildSearchUrl(state.config, state.config.keywords[state.keywordIndex]);
    if (location.href !== expected) {
      location.href = expected;
      return;
    }

    await sleep(1800);
    state = await collectCurrent(state);
    if (state.stopRequested || !state.running) {
      await setMeta('run', state);
      await updateStats(state);
      return;
    }

    const next = { ...state, keywordIndex: state.keywordIndex + 1, scrollCount: 0, oldestDate: null };
    if (next.keywordIndex >= next.config.keywords.length) {
      next.running = false;
      next.finished = true;
      await setMeta('run', next);
      await updateStats(next);
      return;
    }
    await navigateForState(next);
  }

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }
  function toCsv(posts) {
    const rows = [
      ['statusId','username','displayName','postedAt','text','url','matchedKeywords','isReply','isQuote','replies','reposts','likes','collectedAt'],
      ...posts.map((p) => [
        p.statusId,p.username,p.displayName,p.postedAt,p.text,p.url,(p.matchedKeywords||[]).join('|'),
        p.isReply,p.isQuote,p.metrics?.replies,p.metrics?.reposts,p.metrics?.likes,p.collectedAt,
      ]),
    ];
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  }
  function toTxt(posts) {
    return [...posts]
      .sort((a,b) => String(a.postedAt).localeCompare(String(b.postedAt)))
      .map((p) => `${p.postedAt || ''}\n${p.text || ''}\n${p.url || ''}\n検索語: ${(p.matchedKeywords || []).join(', ')}`)
      .join('\n\n---\n\n');
  }
  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createPanel() {
    const root = document.createElement('div');
    root.id = 'xpc-panel';
    root.innerHTML = `
      <style>
        #xpc-panel{position:fixed;right:14px;top:70px;z-index:2147483647;width:290px;background:#111;color:#eee;border:1px solid #555;border-radius:10px;padding:10px;font:12px/1.35 system-ui;box-shadow:0 4px 20px #0008}
        #xpc-panel input,#xpc-panel textarea{box-sizing:border-box;width:100%;margin:2px 0 7px;background:#222;color:#fff;border:1px solid #555;border-radius:5px;padding:5px}
        #xpc-panel textarea{height:92px;resize:vertical}
        #xpc-panel button{appearance:none!important;-webkit-appearance:none!important;margin:2px!important;padding:6px 9px!important;cursor:pointer!important;background:#1d9bf0!important;color:#fff!important;border:1px solid #1d9bf0!important;border-radius:6px!important;font:600 12px/1.2 system-ui!important;opacity:1!important;-webkit-text-fill-color:#fff!important}
        #xpc-panel button:hover{filter:brightness(.92)}
        #xpc-panel .row{display:flex;gap:4px;flex-wrap:wrap}
        #xpc-panel .stats{margin-top:7px;padding-top:7px;border-top:1px solid #444;white-space:pre-line}
      </style>
      <b>X Post Collector PoC</b>
      <label>ユーザー名<input data-k="username" value="${DEFAULTS.username}"></label>
      <label>開始日<input data-k="startDate" type="date" value="${DEFAULTS.startDate}"></label>
      <label>終了日 (until・排他的)<input data-k="endDate" type="date" value="${DEFAULTS.endDate}"></label>
      <label>検索語（1行1件）<textarea data-k="keywords">${DEFAULTS.keywords.join('\n')}</textarea></label>
      <label><input data-k="logging" type="checkbox" style="width:auto"> ログON</label>
      <div class="row"><button data-a="start">収集開始</button><button data-a="resume">続きから再開</button><button data-a="stop">停止</button></div>
      <div class="row"><button data-a="json">JSON</button><button data-a="csv">CSV</button><button data-a="txt">TXT</button></div>
      <div class="stats" data-role="stats">待機中</div>`;

    document.body.appendChild(root);
    const readConfig = () => ({
      username: root.querySelector('[data-k="username"]').value.trim().replace(/^@/, ''),
      startDate: root.querySelector('[data-k="startDate"]').value,
      endDate: root.querySelector('[data-k="endDate"]').value,
      keywords: root.querySelector('[data-k="keywords"]').value.split(/\n/).map((s) => s.trim()).filter(Boolean),
      logging: root.querySelector('[data-k="logging"]').checked,
      maxScrolls: DEFAULTS.maxScrolls,
      stagnantLimit: DEFAULTS.stagnantLimit,
      minDelayMs: DEFAULTS.minDelayMs,
      maxDelayMs: DEFAULTS.maxDelayMs,
    });
    return {
      root,
      readConfig,
      setStats: (text) => { root.querySelector('[data-role="stats"]').textContent = text; },
    };
  }

  async function onAction(action) {
    if (action === 'start') {
      const config = panel.readConfig();
      if (!config.username || !config.startDate || !config.endDate || !config.keywords.length) {
        alert('ユーザー・期間・検索語を入力してください。');
        return;
      }
      const state = {
        config,
        keywordIndex: 0,
        scrollCount: 0,
        duplicateCount: 0,
        oldestDate: null,
        running: true,
        stopRequested: false,
        startedAt: new Date().toISOString(),
      };
      await navigateForState(state);
      return;
    }

    if (action === 'resume') {
      const state = await getMeta('run');
      if (!state) {
        alert('再開できる保存状態がありません。');
        return;
      }
      await navigateForState({ ...state, running: true, stopRequested: false });
      return;
    }

    if (action === 'stop') {
      const state = await getMeta('run');
      if (state) {
        const next = { ...state, running: false, stopRequested: true };
        await setMeta('run', next);
        await updateStats(next);
      }
      return;
    }

    const posts = await getAllPosts();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (action === 'json') downloadText(`x-posts-${stamp}.json`, JSON.stringify([...posts].sort((a,b) => String(a.postedAt).localeCompare(String(b.postedAt))), null, 2), 'application/json;charset=utf-8');
    if (action === 'csv') downloadText(`x-posts-${stamp}.csv`, toCsv(posts), 'text/csv;charset=utf-8');
    if (action === 'txt') downloadText(`x-posts-${stamp}.txt`, toTxt(posts), 'text/plain;charset=utf-8');
  }

  function boot() {
    if (!document.body) {
      setTimeout(boot, 200);
      return;
    }
    panel = createPanel();
    panel.root.addEventListener('click', (e) => {
      const action = e.target?.dataset?.a;
      if (!action) return;
      onAction(action).catch((err) => {
        console.error('[XPC]', err);
        alert(`XPC error: ${err.message}`);
      });
    });

    getMeta('run').then((state) => {
      if (state) updateStats(state);
      if (state?.running && !state.stopRequested) runPersisted().catch((err) => console.error('[XPC]', err));
    });
  }

  boot();
})();
