/* A tiny key/value store on IndexedDB.
 *
 * Images used to live in localStorage, which gives the whole origin about 5 MB
 * and made anything over ~900 KB unsavable — a cover photo or a screenshot of a
 * TikTok grid is comfortably past both, so they vanished on reload. IndexedDB
 * has orders of magnitude more room and no per-item ceiling.
 *
 * Values are still data URLs rather than Blobs, because the PNG export renders
 * through an SVG <foreignObject> that cannot fetch a blob: URL. See js/export.js.
 *
 * Everything degrades to in-memory if IndexedDB is unavailable — a private
 * window, or a browser with site data blocked — so the tool keeps working for
 * the session and simply forgets afterwards.
 */

const DB_NAME = 'onscreen-socials';
const STORE = 'kv';

let dbPromise = null;
let broken = false;
const memory = new Map();

function open() {
  if (broken) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch((err) => {
    broken = true;
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(req?.result);
  }));
}

/** True once IndexedDB has failed and everything is running from memory. */
export function isMemoryOnly() { return broken; }

export async function get(key) {
  try {
    return await run('readonly', (s) => s.get(key));
  } catch {
    return memory.get(key);
  }
}

export async function set(key, value) {
  memory.set(key, value);
  try {
    await run('readwrite', (s) => s.put(value, key));
    return true;
  } catch {
    // Out of quota, or no IndexedDB at all. The value is still in memory, so the
    // session carries on; the caller decides whether to say anything.
    return false;
  }
}

export async function del(key) {
  memory.delete(key);
  try { await run('readwrite', (s) => s.delete(key)); } catch { /* nothing to remove */ }
}

export async function clear() {
  memory.clear();
  try { await run('readwrite', (s) => s.clear()); } catch { /* nothing to clear */ }
}
