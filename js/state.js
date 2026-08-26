/* Per-account edits: capture from the DOM, restore into it, persist.
 *
 * Text goes to localStorage; images go to IndexedDB via js/store.js. They used
 * to share localStorage, which gives the whole origin ~5 MB and made anything
 * over 900 KB unsavable — a cover photo or a screenshot of a TikTok grid is past
 * both, so those quietly vanished on reload.
 *
 * Videos are still session-only. A few seconds of 1080p as a data URL dwarfs
 * everything else and would make every save crawl.
 */

import { rememberAspect, clearOffset, getOffset } from './cover.js';
import * as store from './store.js';
import { getShared, setShared, inferShared, isOwn, setOwn } from './avatars.js';

export const KEY = 'onscreen-socials-v1';

/* The tool used to key saved media by DOM order: 'm' + index over
 * querySelectorAll('[data-img],[data-slot]'). Any markup change silently
 * reattached saved images to the wrong slots, and the save format is about to
 * become public, so slots now carry explicit data-mid names. This table is the
 * one-time translation from the old scheme; the order is the old document order
 * and must not be re-sorted. */
const LEGACY_KEY = 'ttk-social-mockups-v1';
const LEGACY_MIDS = [
  'ig-avatar', 'ig-post-avatar', 'ig-slot',
  'fb-cover', 'fb-avatar', 'fb-post-avatar', 'fb-slot',
  'tt-avatar', 'tt-slot',
  'tt-cell-1', 'tt-cell-2', 'tt-cell-3', 'tt-cell-4',
  'tt-cell-5', 'tt-cell-6', 'tt-cell-7', 'tt-cell-8',
];

/* Text lives in localStorage under KEY; pictures live in IndexedDB under this
 * one, which has room for them. See js/store.js. */
const MEDIA_KEY = 'media';

let STATE = {};
let canStore = true;
let onStatus = () => {};

/** `fn(message)` is called whenever there is something to say about saving. */
export function onSaveStatus(fn) { onStatus = fn; }

export function hasEdits(key) { return Object.hasOwn(STATE, key); }
export function clearEdits(key) { delete STATE[key]; }

/** Drop every saved edit. The preset files themselves are untouched. */
export function clearAll() {
  STATE = {};
  try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
  return store.del(MEDIA_KEY);
}

/* ───────────────────────── DOM ↔ state ───────────────────────── */

function mediaEls() { return document.querySelectorAll('[data-img],[data-slot]'); }

function makeEl(url, isVideo) {
  if (!isVideo) {
    const i = document.createElement('img');
    i.setAttribute('src', url);
    return i;
  }
  const v = document.createElement('video');
  v.src = url;
  v.autoplay = v.loop = v.muted = v.playsInline = true;
  v.setAttribute('playsinline', '');
  return v;
}

/** Read the current DOM into STATE under `key`. */
export function capture(key) {
  const fields = {};
  for (const el of document.querySelectorAll('[data-f]')) {
    fields[el.dataset.f] = el.innerHTML;
  }

  const media = {};
  for (const el of mediaEls()) {
    const id = el.dataset.mid;
    if (el.hasAttribute('data-slot')) {
      const kid = el.querySelector('.main')?.firstChild;
      if (kid) media[id] = { t: kid.tagName === 'VIDEO' ? 'v' : 'i', s: kid.getAttribute('src') };
    } else if (el.style.backgroundImage) {
      media[id] = { t: 'bg', s: el.style.backgroundImage };
      // Where a repositionable image has been dragged to.
      const y = getOffset(el);
      if (y) media[id].y = y;
      // An avatar slot that has opted out of the shared picture.
      if (el.hasAttribute('data-avatar') && isOwn(el)) media[id].own = true;
    }
  }

  // Not a slot, so nothing in the DOM carries it: which picture the avatar
  // slots are currently following. See js/avatars.js.
  const shared = getShared();
  if (shared) media._avatar = { t: 'bg', s: shared };

  STATE[key] = { fields, media };
}

/**
 * What account `key` should currently look like: the preset with this browser's
 * edits layered over it.
 *
 * Edits are layered *over* the preset rather than replacing it. A saved blob
 * written before some field existed would otherwise leave that element
 * untouched, showing whatever the previously selected account had left in it.
 * Media works the same way, so a preset can ship avatars and the user can
 * replace individual ones without losing the rest.
 */
export function merged(key, preset = {}) {
  const saved = STATE[key];
  return {
    fields: { ...preset.fields, ...saved?.fields },
    media: { ...preset.media, ...saved?.media },
  };
}

/** Paint account `key` into the DOM. */
export function restore(key, preset) {
  const { fields, media } = merged(key, preset);

  for (const el of document.querySelectorAll('[data-f]')) {
    const v = fields[el.dataset.f];
    if (v !== undefined) el.innerHTML = v;
  }

  for (const el of mediaEls()) {
    const rec = media[el.dataset.mid];
    if (el.hasAttribute('data-slot')) {
      const main = el.querySelector('.main');
      const fill = el.querySelector('.fill');
      main.replaceChildren();
      fill.replaceChildren();
      el.classList.remove('loaded');
      if (rec) {
        main.append(makeEl(rec.s, rec.t === 'v'));
        fill.append(makeEl(rec.s, rec.t === 'v'));
        el.classList.add('loaded');
      }
    } else if (rec) {
      el.style.backgroundImage = rec.s;
      el.classList.remove('empty');
      if (el.hasAttribute('data-avatar')) setOwn(el, rec.own === true);
      if (el.hasAttribute('data-reposition')) {
        rememberAspect(el);
        // setOffset clamps against the image, which is not measured yet on this
        // tick, so write the stored value straight through and let the next drag
        // clamp it.
        clearOffset(el);
        if (rec.y) {
          el.dataset.offsetY = String(rec.y);
          el.style.backgroundPosition = `center ${rec.y}px`;
        }
      }
    } else {
      el.style.backgroundImage = '';
      el.classList.add('empty');
      if (el.hasAttribute('data-reposition')) clearOffset(el);
      if (el.hasAttribute('data-avatar')) setOwn(el, false);
    }
  }

  // Accounts saved before avatars were linked have no _avatar; work it out from
  // what the slots are actually showing.
  setShared(media._avatar?.s ?? inferShared());
}

/* ───────────────────────── persistence ───────────────────────── */

/** Text only — small, and localStorage is a fine home for it. */
function fieldsOnly() {
  return Object.fromEntries(
    Object.entries(STATE).map(([key, entry]) => [key, { fields: entry.fields }])
  );
}

/** Pictures, for IndexedDB. Videos stay session-only: a few seconds of 1080p as
 *  a data URL dwarfs everything else and would make every save crawl. */
function mediaOnly() {
  const out = {};
  let videos = 0;
  for (const [key, entry] of Object.entries(STATE)) {
    const media = {};
    for (const [id, rec] of Object.entries(entry.media)) {
      if (rec.t === 'v') { videos++; continue; }
      media[id] = rec;
    }
    if (Object.keys(media).length) out[key] = media;
  }
  return [out, videos];
}

let mediaWrite = null;

export function persist(key) {
  capture(key);
  if (!canStore) return;

  try {
    localStorage.setItem(KEY, JSON.stringify(fieldsOnly()));
  } catch {
    canStore = false;
    onStatus('text not saved');
    return;
  }

  // Images go to IndexedDB, which has room for them. The write is async and
  // coalesced: a burst of edits should not queue up a dozen full rewrites.
  const [media] = mediaOnly();
  const write = store.set(MEDIA_KEY, media).then((ok) => {
    if (write !== mediaWrite) return;          // superseded by a later save
    onStatus(ok ? 'saved' : 'saved — images did not fit');
  });
  mediaWrite = write;
}

/** Read saved edits, migrating the pre-rename key if that is all there is. */
export async function load() {
  try {
    const probe = `${KEY}-probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch {
    canStore = false;
    onStatus('session only');
    return;
  }

  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { STATE = JSON.parse(raw); } catch { STATE = {}; }
    // Older saves kept images in localStorage too. Anything still there is
    // carried across; from now on pictures live in IndexedDB.
    const stranded = {};
    for (const [key, entry] of Object.entries(STATE)) {
      if (entry.media && Object.keys(entry.media).length) stranded[key] = entry.media;
      entry.media = entry.media ?? {};
    }

    const stored = (await store.get(MEDIA_KEY)) ?? {};
    for (const [key, media] of Object.entries(stored)) {
      STATE[key] = STATE[key] ?? { fields: {}, media: {} };
      // Anything stranded in localStorage was written more recently than the
      // migration, so let it win on a clash.
      STATE[key].media = { ...media, ...STATE[key].media };
    }

    if (Object.keys(stranded).length) {
      await store.set(MEDIA_KEY, mediaOnly()[0]);
      try { localStorage.setItem(KEY, JSON.stringify(fieldsOnly())); } catch { /* fine */ }
    }
    return;
  }

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;

  try {
    const old = JSON.parse(legacy);
    for (const [key, entry] of Object.entries(old)) {
      const media = {};
      for (const [id, rec] of Object.entries(entry.media ?? {})) {
        const name = LEGACY_MIDS[Number(id.slice(1))];
        if (name) media[name] = rec;
      }
      STATE[key] = { fields: entry.fields ?? {}, media };
    }
    await store.set(MEDIA_KEY, mediaOnly()[0]);
    // The old key is left in place rather than removed: if this migration got
    // something wrong, the original is still there to go back to.
    onStatus('imported earlier edits');
  } catch {
    STATE = {};
  }
}
