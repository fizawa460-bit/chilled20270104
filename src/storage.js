const DB_NAME = 'x-post-collector';
const DB_VERSION = 1;
const POSTS = 'posts';
const META = 'meta';

export function openDb() {
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

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertPost(post) {
  const db = await openDb();
  const tx = db.transaction(POSTS, 'readwrite');
  const store = tx.objectStore(POSTS);
  const existing = await request(store.get(post.statusId));
  const merged = existing
    ? { ...existing, ...post, matchedKeywords: [...new Set([...(existing.matchedKeywords || []), ...(post.matchedKeywords || [])])] }
    : post;
  await request(store.put(merged));
  db.close();
  return { post: merged, duplicate: Boolean(existing) };
}

export async function getAllPosts() {
  const db = await openDb();
  const tx = db.transaction(POSTS, 'readonly');
  const rows = await request(tx.objectStore(POSTS).getAll());
  db.close();
  return rows;
}

export async function setMeta(key, value) {
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  await request(tx.objectStore(META).put({ key, value }));
  db.close();
}

export async function getMeta(key) {
  const db = await openDb();
  const tx = db.transaction(META, 'readonly');
  const row = await request(tx.objectStore(META).get(key));
  db.close();
  return row?.value ?? null;
}

export async function clearAll() {
  const db = await openDb();
  const tx = db.transaction([POSTS, META], 'readwrite');
  tx.objectStore(POSTS).clear();
  tx.objectStore(META).clear();
  db.close();
}
