/* Accounts.
 *
 * An account is a flat bag of field values keyed by the data-f names in
 * index.html, plus a `slug` that names exported files and a `label` for the
 * dropdown. They live in presets/*.json rather than in this file so that adding
 * accounts does not mean editing code.
 *
 * Three sources, merged in this order (later wins on a key clash):
 *   1. DEMO below — inline, so the app still works if every fetch fails
 *   2. presets/*.json listed in presets/index.json
 *   3. presets/local.json — never committed; 404 is the normal case
 *   4. anything the user loaded by hand, cached in localStorage
 */

const CACHE_KEY = 'onscreen-socials-presets-v1';

/** Matches the markup defaults in index.html. Deliberately plain and English:
 *  whoever lands on the hosted page should see the product, not someone else's
 *  student union. No emoji either — those rasterise from the OS font. */
const DEMO = {
  demo: {
    label: 'Demo account',
    slug: 'demo',
    fields: {
      time: '9:41',

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
      time: '9:41',

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
    };
  }
  return out;
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

  // presets/local.json is gitignored, so a 404 here is the normal case on a
  // public deployment and is not worth reporting.
  for (const file of [...listed, 'local.json']) {
    const url = `presets/${file}`;
    try {
      Object.assign(accounts, validate(await fetchJson(url), url));
    } catch (err) {
      if (file !== 'local.json') problems.push(String(err.message ?? err));
    }
  }

  Object.assign(accounts, readCache());
  return { accounts, problems };
}
