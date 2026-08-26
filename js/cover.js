/* Dragging a cover photo up and down.
 *
 * The cover is sized to fill the width exactly (see .fb .cover in app.css), so
 * there is never any horizontal slack — only the vertical crop is a choice, and
 * that is what Facebook lets you drag too.
 *
 * The offset is stored in real screen pixels alongside the image in the account's
 * media record, so it survives a reload, travels in a saved preset, and is
 * applied to the export like anything else.
 */

/** Pull the data: URL back out of a computed `url("…")` value. */
function srcOf(el) {
  const m = /url\(\s*["']?(data:[^"')]+)["']?\s*\)/.exec(el.style.backgroundImage);
  return m ? m[1] : null;
}

/**
 * Note the image's aspect ratio on the element so a drag can work out how far
 * there is to go. Async, but a drag is always long after the image landed.
 */
export function rememberAspect(el) {
  const src = srcOf(el);
  if (!src) { delete el.dataset.aspect; return; }
  const img = new Image();
  img.onload = () => { el.dataset.aspect = String(img.naturalWidth / img.naturalHeight); };
  img.src = src;
}

export function getOffset(el) {
  return Number(el.dataset.offsetY ?? 0);
}

/** Move the image to `y` real pixels from the top, clamped to the image. */
export function setOffset(el, y) {
  const aspect = Number(el.dataset.aspect);
  let clamped = y;

  if (aspect > 0) {
    // How tall the image ends up once scaled to the full width of the slot.
    const scaledHeight = el.offsetWidth / aspect;
    // Negative: how far up it can travel before its bottom edge shows.
    const furthestUp = Math.min(0, el.offsetHeight - scaledHeight);
    clamped = Math.min(0, Math.max(furthestUp, y));
  }

  el.dataset.offsetY = String(Math.round(clamped));
  el.style.backgroundPosition = `center ${Math.round(clamped)}px`;
}

export function clearOffset(el) {
  delete el.dataset.offsetY;
  el.style.backgroundPosition = '';
}

/**
 * Wire vertical dragging on every [data-reposition] slot.
 * `onChange` fires when a drag finishes, so the caller can save.
 */
export function initReposition({ onChange = () => {} } = {}) {
  for (const el of document.querySelectorAll('[data-reposition]')) {
    let startY = 0;
    let startOffset = 0;
    let moved = false;

    const move = (ev) => {
      // #stage is CSS-scaled for viewing, so pointer travel has to be divided
      // back out to land on real pixels.
      const scale = el.getBoundingClientRect().width / el.offsetWidth || 1;
      const delta = (ev.clientY - startY) / scale;
      if (Math.abs(delta) > 2) moved = true;
      setOffset(el, startOffset + delta);
    };

    const end = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      el.classList.remove('dragging');
      if (moved) {
        // Swallow the click that follows, or the file picker opens on every drag.
        el.dataset.dragged = '1';
        onChange(el);
      }
    };

    el.addEventListener('mousedown', (ev) => {
      if (el.classList.contains('empty')) return;   // nothing to reposition yet
      ev.preventDefault();
      startY = ev.clientY;
      startOffset = getOffset(el);
      moved = false;
      el.classList.add('dragging');
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    });

    // Back to the top, the way it arrived.
    el.addEventListener('dblclick', () => {
      if (el.classList.contains('empty')) return;
      setOffset(el, 0);
      onChange(el);
    });
  }
}
