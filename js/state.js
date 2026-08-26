/* Per-account edits: capture from the DOM, restore into it, persist to localStorage.
 *
 * Text and images survive a reload. Videos do not — a few seconds of 1080p as a
 * data URL is tens of megabytes and there is nowhere to put it.
 */

import { rememberAspect, setOffset, clearOffset, getOffset } from './cover.js';

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

/* Anything larger than this is kept in the session but left out of localStorage;
 * the whole origin only gets ~5 MB. */
const MAX_STORED_IMAGE = 900_000;

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
    }
  }

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
    }
  }
}

/* ───────────────────────── persistence ───────────────────────── */

/** Strip what localStorage cannot hold. Returns [payload, skippedCount]. */
function serialisable(includeMedia) {
  const out = {};
  let skipped = 0;

  for (const [key, entry] of Object.entries(STATE)) {
    const media = {};
    if (includeMedia) {
      for (const [id, rec] of Object.entries(entry.media)) {
        // Videos are session-only by design; oversized stills are dropped so one
        // big drag-and-drop cannot cost the user all their typing.
        if (rec.t === 'v') continue;
        if (rec.s.length > MAX_STORED_IMAGE) { skipped++; continue; }
        media[id] = rec;
      }
    }
    out[key] = { fields: entry.fields, media };
  }
  return [out, skipped];
}

export function persist(key) {
  capture(key);
  if (!canStore) return;

  const [full, skipped] = serialisable(true);
  try {
    localStorage.setItem(KEY, JSON.stringify(full));
    onStatus(skipped ? `saved · ${skipped} image${skipped > 1 ? 's' : ''} too large` : 'saved');
    return;
  } catch { /* over quota — fall through */ }

  // Text is the part worth keeping, so drop the images and try again rather
  // than giving up on saving altogether.
  try {
    localStorage.setItem(KEY, JSON.stringify(serialisable(false)[0]));
    onStatus('saved — text only, images did not fit');
  } catch {
    canStore = false;
    onStatus('not saved');
  }
}

/** Read saved edits, migrating the pre-rename key if that is all there is. */
export function load() {
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
    // The old key is left in place rather than removed: if this migration got
    // something wrong, the original is still there to go back to.
    onStatus('imported earlier edits');
  } catch {
    STATE = {};
  }
}
