/* One profile picture across all five avatar slots.
 *
 * An account's picture appears on three profile headers and two post rows, and
 * is almost always the same image — filling them separately is five drops per
 * account for no gain.
 *
 * So a dropped picture goes to every avatar slot. A slot can opt out: hold Alt
 * while dropping (or while clicking to pick a file) and only that slot takes the
 * image. It then stops following, and later shared drops leave it alone until
 * you drop on it again without Alt.
 *
 * Opting out is deliberately a flag rather than something inferred from the
 * images. A first attempt compared each slot against the picture they were
 * sharing, which cannot tell "change the picture everywhere" apart from "give
 * this one slot something different" — both look like a drop on a slot that is
 * currently in step.
 */

const SLOTS = '[data-avatar]';
const OWN = 'avatarOwn';       // dataset flag: this slot has its own picture

let shared = null;

export function getShared() { return shared; }
export function setShared(url) { shared = url ?? null; }

export function srcOf(el) {
  const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(el.style.backgroundImage);
  return m ? m[1] : null;
}

export function isOwn(el) { return el.dataset[OWN] === '1'; }

export function setOwn(el, own) {
  if (own) el.dataset[OWN] = '1';
  else delete el.dataset[OWN];
}

function paint(el, url) {
  el.style.backgroundImage = `url(${url})`;
  el.classList.remove('empty');
}

/**
 * Put `url` on `el`.
 *
 * `onlyThis` (Alt held) keeps it to this slot and marks it as having its own
 * picture. Otherwise it becomes the shared one and every slot that has not opted
 * out follows. Returns how many other slots changed.
 */
export function applyAvatar(el, url, onlyThis = false) {
  if (onlyThis) {
    setOwn(el, true);
    return 0;
  }

  setOwn(el, false);              // dropping without Alt puts it back in step
  let carried = 0;
  for (const other of document.querySelectorAll(SLOTS)) {
    if (other === el || isOwn(other)) continue;
    paint(other, url);
    carried++;
  }
  shared = url;
  return carried;
}

/**
 * Work out what the slots are sharing, for accounts saved before this existed:
 * if every filled avatar holds the same image, that is the shared one.
 */
export function inferShared() {
  const values = [...document.querySelectorAll(SLOTS)].map(srcOf).filter(Boolean);
  if (!values.length) return null;
  return values.every((v) => v === values[0]) ? values[0] : null;
}
