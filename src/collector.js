import { parseVisiblePosts } from './parser.js';
import { upsertPost, setMeta, getMeta } from './storage.js';

export const DEFAULTS = {
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

export function buildSearchUrl(config, keyword) {
  const q = `from:${config.username} ${keyword} since:${config.startDate} until:${config.endDate}`;
  return `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (config) => config.minDelayMs + Math.random() * (config.maxDelayMs - config.minDelayMs);

export async function collectCurrentKeyword(state, onStats = () => {}) {
  const keyword = state.config.keywords[state.keywordIndex];
  let stagnant = 0;
  let uniqueAdded = 0;
  let duplicateCount = state.duplicateCount || 0;
  let oldest = null;

  for (let scroll = state.scrollCount || 0; scroll < state.config.maxScrolls; scroll += 1) {
    if ((await getMeta('run'))?.stopRequested) return { ...state, stopped: true, scrollCount: scroll };
    const visible = parseVisiblePosts(keyword);
    let roundAdded = 0;

    for (const post of visible) {
      const result = await upsertPost(post);
      if (result.duplicate) duplicateCount += 1;
      else { roundAdded += 1; uniqueAdded += 1; }
      if (post.postedAt && (!oldest || post.postedAt < oldest)) oldest = post.postedAt;
    }

    stagnant = roundAdded === 0 ? stagnant + 1 : 0;
    const nextState = { ...state, scrollCount: scroll + 1, duplicateCount, oldestDate: oldest, uniqueAdded };
    await setMeta('run', nextState);
    onStats(nextState);

    if (oldest && oldest.slice(0, 10) < state.config.startDate) break;
    if (stagnant >= state.config.stagnantLimit) break;
    window.scrollBy({ top: Math.max(window.innerHeight * 0.9, 700), behavior: 'smooth' });
    await sleep(randomDelay(state.config));
  }

  return { ...state, scrollCount: 0, duplicateCount, oldestDate: oldest, uniqueAdded };
}
