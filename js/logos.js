/* Platform logos.
 *
 * The mockups carry no marks of their own: colour and layout do the recognising,
 * which keeps the project clear of Meta's and ByteDance's trademarks. That works
 * for someone who uses all three apps and not for an audience being shown a
 * screen for three seconds, so there is a slot in each top bar for a logo you
 * supply yourself.
 *
 * Deliberately NOT part of the account presets:
 *   · a logo belongs to the platform, not the account — you would otherwise drop
 *     the same three files once per account
 *   · presets get emailed around and committed; trademarked artwork should not
 *     travel with them, and nothing here ends up in the repository
 *
 * So they live in their own localStorage key, apply to every account, and are
 * dropped in once per browser.
 */

import { isLocal } from './env.js';

const KEY = 'onscreen-socials-logos-v1';
const PLATFORMS = ['ig', 'fb', 'tt'];

let LOGOS = {};

function slots() { return document.querySelectorAll('[data-logo]'); }

function paint() {
  for (const el of slots()) {
    const url = LOGOS[el.dataset.logo];
    if (url) {
      const img = document.createElement('img');
      img.setAttribute('src', url);
      img.setAttribute('alt', '');
      el.replaceChildren(img);
    } else {
      el.replaceChildren();
    }
  }
  document.body.classList.toggle('has-logos', PLATFORMS.some((p) => LOGOS[p]));
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(LOGOS));
    return true;
  } catch {
    // A few hundred KB of PNG per platform should fit, but a huge SVG or an
    // uncompressed export might not.
    return false;
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('could not read file'));
    r.readAsDataURL(file);
  });
}

/* Files anyone running their own copy can drop in once, so the three logos are
 * simply there rather than being dragged in per browser. They are defaults: a
 * logo dropped through the UI is a deliberate act and outranks them. */
const FILES = {
  ig: 'assets/logo-instagram.png',
  fb: 'assets/logo-facebook.png',
  tt: 'assets/logo-tiktok.png',
};

async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function loadLogos() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    for (const p of PLATFORMS) {
      if (typeof raw[p] === 'string' && raw[p].startsWith('data:')) LOGOS[p] = raw[p];
    }
  } catch { LOGOS = {}; }
  paint();

  // Fill any platform the browser has nothing for from assets/. Missing files
  // are the normal case — on a deployed site the folder is not published.
  const missing = isLocal() ? PLATFORMS.filter((p) => !LOGOS[p]) : [];
  if (!missing.length) return;

  const found = await Promise.all(missing.map(async (p) => {
    try { return [p, await fetchAsDataUrl(FILES[p])]; } catch { return null; }
  }));

  let any = false;
  for (const hit of found) {
    if (!hit) continue;
    [LOGOS[hit[0]]] = [hit[1]];
    any = true;
  }
  // Deliberately not saved: they come from the files each time, so replacing a
  // file replaces the logo rather than being shadowed by a stale copy.
  if (any) paint();
}

export function clearLogos() {
  LOGOS = {};
  try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
  paint();
}

export function hasLogos() { return PLATFORMS.some((p) => LOGOS[p]); }

/** Wire the three slots for click-to-pick and drag-and-drop. */
export function initLogos({ onStatus = () => {} } = {}) {
  const picker = document.getElementById('logoPicker');
  let target = null;

  const accept = async (el, file) => {
    if (!file || !file.type.startsWith('image/')) {
      onStatus('logo must be an image');
      return;
    }
    try {
      LOGOS[el.dataset.logo] = await readAsDataUrl(file);
      paint();
      onStatus(save() ? 'logo saved' : 'logo set — too large to remember');
    } catch (err) {
      onStatus(`could not read ${file.name}`);
    }
  };

  for (const el of slots()) {
    el.addEventListener('click', () => {
      target = el;
      picker.value = '';
      picker.click();
    });
    el.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      el.style.outline = '4px solid #00ffbe';
    });
    el.addEventListener('dragleave', () => { el.style.outline = ''; });
    el.addEventListener('drop', (ev) => {
      ev.preventDefault();
      el.style.outline = '';
      accept(el, ev.dataTransfer?.files?.[0]);
    });
  }

  picker.addEventListener('change', () => {
    const el = target;
    target = null;
    if (el) accept(el, picker.files?.[0]);
  });
}
