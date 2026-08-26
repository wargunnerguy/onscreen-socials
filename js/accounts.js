/* Accounts a person creates in the page, rather than in a file.
 *
 * Presets come from JSON on disk, which is fine for someone editing the repo and
 * useless for someone who has just opened the hosted site: without this, making
 * a second mockup means exporting the JSON, copying an account block by hand and
 * loading it back.
 *
 * This layer holds what the page itself creates — new accounts, duplicates,
 * renames — plus the keys of preset accounts that have been deleted. It is
 * applied after every preset source, so it always wins: it is the most
 * deliberate thing the user did.
 */

const KEY = 'onscreen-socials-accounts-v1';

let mine = {};        // key -> { label, slug, fields?, lang? }
let hidden = [];      // preset accounts the user removed

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, accounts: mine, hidden }));
  } catch { /* full or blocked; the session still works */ }
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    mine = (raw.accounts && typeof raw.accounts === 'object') ? raw.accounts : {};
    hidden = Array.isArray(raw.hidden) ? raw.hidden : [];
  } catch {
    mine = {};
    hidden = [];
  }
}

/** Fold this layer over whatever the presets produced. */
export function apply(accounts) {
  for (const key of hidden) delete accounts[key];
  Object.assign(accounts, mine);
  return accounts;
}

export function isMine(key) { return Object.hasOwn(mine, key); }

/** A filename-safe stem, and a key that is not already taken. */
export function slugify(label) {
  const base = label.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents for filenames
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'account';
}

export function freeKey(base, taken) {
  let key = base;
  let n = 2;
  while (Object.hasOwn(taken, key)) key = `${base}-${n++}`;
  return key;
}

export function create(key, account) {
  mine[key] = account;
  persist();
}

export function rename(key, label, slug) {
  // A preset account can be renamed too; the override simply carries the whole
  // definition from then on.
  mine[key] = { ...(mine[key] ?? {}), label, slug };
  persist();
}

/** Keep the full definition, so a renamed or duplicated preset account survives. */
export function adopt(key, account) {
  mine[key] = { label: account.label, slug: account.slug, fields: { ...account.fields } };
  if (account.lang) mine[key].lang = account.lang;
  persist();
}

export function remove(key) {
  delete mine[key];
  if (!hidden.includes(key)) hidden.push(key);
  persist();
}

export function clearAll() {
  mine = {};
  hidden = [];
  try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
}
