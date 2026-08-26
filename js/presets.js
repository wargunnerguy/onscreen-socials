/* Accounts.
 *
 * An account is a flat bag of field values keyed by the data-f names in
 * index.html, plus a `slug` that names exported files and a `label` for the
 * dropdown. They live in presets/*.json rather than in this file so that adding
 * accounts does not mean editing code.
 *
 * Four sources, merged in this order — later wins on a key clash:
 *   1. DEMO below — inline, so the app still works if every fetch fails
 *   2. whatever was last opened with Load…, cached in localStorage
 *   3. presets/*.json listed in presets/index.json
 *   4. presets/local.json — never committed; 404 is the normal case
 *
 * One rule decides that order: a file on disk always outranks the browser cache.
 * The cache is there to supply accounts no file provides, which is what a
 * deployed site needs. Putting it any later means editing a preset file appears
 * to do nothing, which has already caused real confusion.
 */

import { isLocal } from './env.js';

const CACHE_KEY = 'onscreen-socials-presets-v1';

/** Matches the markup defaults in index.html. Deliberately plain and English:
 *  whoever lands on the hosted page should see the product, not someone else's
 *  student union. No emoji either — those rasterise from the OS font. */
const DEMO = {
  demo: {
    label: 'Demo account',
    slug: 'demo',
    fields: {

      igHandle: 'yourhandle', igPosts: '210', igFollowers: '1527', igFollowing: '158',
      igName: 'Your Account Name', igCat: 'Category',
      igBio: 'One line about the account<br>and a second line under it',
      igLink: 'example.com',
      igPostUser: 'yourhandle', igPostLoc: 'Tallinn, Estonia',
      igLikes: '184 likes', igCaption: '<b>yourhandle</b> Caption goes here',
      igTime: '2 HOURS AGO',

      fbTitle: 'Your Page', fbName: 'Your Page',
      fbMeta1: 'Category · Tallinn, Estonia', fbMeta2: '1,204 followers',
      fbPostName: 'Your Page', fbPostTime: '2h',
      fbPostText: 'Post text goes here.',
      fbReact: '62', fbReact2: '4 comments',

      ttTop: 'yourhandle', ttHandle: '@yourhandle',
      ttFollowing: '73', ttFollowers: '2841', ttLikes: '19.4K',
      ttBio: 'One line about the account', ttLink: 'example.com',
      ttViews0: '44.1K', ttViews1: '12.8K', ttViews2: '9,417', ttViews3: '31.2K',
      ttViews4: '6,208', ttViews5: '18.5K', ttViews6: '4,933', ttViews7: '27.6K',
      ttViews8: '8,120',
    },
  },

  blank: {
    label: 'Blank',
    slug: 'mockup',
    fields: {

      igHandle: 'username', igPosts: '0', igFollowers: '0', igFollowing: '0',
      igName: 'Account name', igCat: 'Category', igBio: 'Bio', igLink: 'link',
      igPostUser: 'username', igPostLoc: 'Location',
      igLikes: '0 likes', igCaption: '<b>username</b> Caption', igTime: 'JUST NOW',

      fbTitle: 'Page name', fbName: 'Page name',
      fbMeta1: 'Category · Location', fbMeta2: '0 followers',
      fbPostName: 'Page name', fbPostTime: '1m', fbPostText: 'Post text',
      fbReact: '0', fbReact2: '0 comments',

      ttTop: 'username', ttHandle: '@username',
      ttFollowing: '0', ttFollowers: '0', ttLikes: '0',
      ttBio: 'Bio', ttLink: 'link',
      ttViews0: '0', ttViews1: '0', ttViews2: '0', ttViews3: '0',
      ttViews4: '0', ttViews5: '0', ttViews6: '0', ttViews7: '0', ttViews8: '0',
    },
  },
};

/** Reject anything that is not a preset before it reaches the DOM. */
export function validate(doc, source) {
  if (!doc || typeof doc !== 'object') throw new Error(`${source}: not an object`);
  if (doc.version !== 1) throw new Error(`${source}: unsupported version ${doc.version}`);
  if (!doc.accounts || typeof doc.accounts !== 'object') throw new Error(`${source}: no accounts`);

  const out = {};
  for (const [key, acc] of Object.entries(doc.accounts)) {
    if (!acc?.fields || typeof acc.fields !== 'object') throw new Error(`${source}: "${key}" has no fields`);
    out[key] = {
      label: String(acc.label ?? key),
      slug: String(acc.slug ?? key),
      // Field values are written to innerHTML, so keep them to strings and let
      // the caller decide about trust. Presets are files the user chose to open.
      fields: Object.fromEntries(
        Object.entries(acc.fields).map(([k, v]) => [k, String(v)])
      ),
      media: validateMedia(acc.media),
      // Chrome language for this account; unknown values fall back in applyLang.
      lang: typeof acc.lang === 'string' ? acc.lang : undefined,
    };
  }
  return out;
}

/**
 * Optional per-account images, keyed by the data-mid names in index.html.
 *
 * These files get emailed between people, so only data: URLs are accepted.
 * Nothing else has any business being here, and refusing the rest keeps a
 * preset from pointing the page at a URL that would phone home when opened.
 */
function validateMedia(media) {
  if (!media || typeof media !== 'object') return {};

  return Object.fromEntries(
    Object.entries(media).filter(([, rec]) => {
      if (!rec || typeof rec.s !== 'string') return false;
      if (!['bg', 'i', 'v'].includes(rec.t)) return false;
      // 'bg' arrives as the CSS value url("data:…"); the others are bare URLs.
      return rec.t === 'bg'
        ? /^url\(\s*["']?data:/i.test(rec.s)
        : /^data:/i.test(rec.s);
    }).map(([id, rec]) => [
      id,
      // y is the vertical crop of a repositionable image, in real pixels.
      {
        t: rec.t,
        s: rec.s,
        // y: vertical crop of a repositionable image. own: an avatar slot that
        // has opted out of the account's shared profile picture.
        ...(Number.isFinite(rec.y) ? { y: rec.y } : {}),
        ...(rec.own === true ? { own: true } : {}),
      },
    ])
  );
}

/**
 * Build a preset document for download — the counterpart to loading one.
 *
 * `merge` is state.merged: it layers this browser's edits over the preset, so
 * what gets written out is what is on screen, not what was originally loaded.
 * Returns the document plus a count of videos left out, which the caller should
 * mention rather than dropping silently.
 */
export function buildDoc(accounts, keys, merge, { includeMedia = true, name = '' } = {}) {
  const doc = {
    version: 1,
    name: name || 'Onscreen Socials accounts',
    generated: new Date().toISOString().slice(0, 10),
    accounts: {},
  };
  let videos = 0;

  for (const key of keys) {
    const acc = accounts[key];
    if (!acc) continue;

    const { fields, media } = merge(key, acc);
    const entry = { label: acc.label, slug: acc.slug, fields };
    if (acc.lang) entry.lang = acc.lang;

    if (includeMedia) {
      const keep = {};
      for (const [id, rec] of Object.entries(media)) {
        // Video is session-only everywhere else, and a few seconds of 1080p as
        // a data URL would dwarf the rest of the file.
        if (rec.t === 'v') { videos++; continue; }
        keep[id] = rec;
      }
      if (Object.keys(keep).length) entry.media = keep;
    }

    doc.accounts[key] = entry;
  }

  return { doc, videos };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function readCache() {
  try {
    return validate(JSON.parse(localStorage.getItem(CACHE_KEY)), 'cached preset');
  } catch {
    return {};
  }
}

/** Remember a hand-loaded preset so it survives a reload, including on a hosted
 *  site where the file itself is not deployed. */
export function cache(doc) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(doc)); } catch { /* full or blocked */ }
}

export function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Collect every account this install can see.
 * Never rejects — a missing or broken preset degrades to the built-in demo.
 * Returns { accounts, problems }.
 */
export async function loadAll() {
  const accounts = { ...DEMO };
  const problems = [];

  let listed = [];
  try {
    const index = await fetchJson('presets/index.json');
    listed = Array.isArray(index?.presets) ? index.presets : [];
  } catch {
    // Also what you get from file:// — the README says to use a local server.
    problems.push('presets/index.json could not be read');
  }

  // A preset loaded by hand, remembered so it survives a reload on a deployed
  // site where the file itself was never published. It goes before the files:
  // its job is to supply accounts no file provides, and a file has to be able to
  // outrank it or editing one appears to do nothing at all.
  Object.assign(accounts, readCache());

  for (const file of listed) {
    const url = `presets/${file}`;
    try {
      Object.assign(accounts, validate(await fetchJson(url), url));
    } catch (err) {
      problems.push(String(err.message ?? err));
    }
  }

  // Gitignored, so it exists locally and never on a deployment. See js/env.js.
  if (isLocal()) {
    try {
      Object.assign(accounts, validate(await fetchJson('presets/local.json'), 'presets/local.json'));
    } catch { /* not present is the normal case */ }
  }

  return { accounts, problems };
}
