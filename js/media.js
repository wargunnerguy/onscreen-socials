/* Getting pictures and footage into the slots.
 *
 * Everything becomes a data URL. That is what makes the tool work with no
 * server, and it is also what the PNG export needs: the SVG <foreignObject> the
 * export renders through cannot fetch a blob: or http: URL, so an <img src>
 * pointing at anything else would come out blank.
 */

import { rememberAspect, clearOffset } from './cover.js';
import { applyAvatar } from './avatars.js';

const ACCEPTED = /^(image|video)\//;

function element(url, isVideo) {
  if (!isVideo) {
    const img = document.createElement('img');
    img.setAttribute('src', url);
    return img;
  }
  const v = document.createElement('video');
  v.src = url;
  v.autoplay = v.loop = v.muted = v.playsInline = true;
  v.setAttribute('playsinline', '');
  return v;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('could not read file'));
    r.readAsDataURL(file);
  });
}

async function loadInto(el, file, onlyThis = false) {
  const url = await readAsDataUrl(file);
  const isVideo = file.type.startsWith('video/');
  let carried = 0;

  if (el.hasAttribute('data-slot')) {
    const main = el.querySelector('.main');
    const fill = el.querySelector('.fill');
    main.replaceChildren(element(url, isVideo));
    // The blurred backdrop behind letterboxed footage is a second copy of the
    // same source, so 'blur fill' needs no extra decode.
    fill.replaceChildren(element(url, isVideo));
    el.classList.add('loaded');
  } else {
    el.style.backgroundImage = `url(${url})`;
    el.classList.remove('empty');
    if (el.hasAttribute('data-reposition')) {
      clearOffset(el);          // a new picture starts at the top
      rememberAspect(el);
    }
    // One profile picture serves every avatar slot unless one has been
    // deliberately given its own.
    if (el.hasAttribute('data-avatar')) carried = applyAvatar(el, url, onlyThis);
  }
  return carried;
}

/**
 * Wire every drop target. `onChange` fires after a file lands, so the caller
 * can save. `onError` gets a message worth showing.
 */
export function initMedia({ onChange = () => {}, onError = () => {} } = {}) {
  const picker = document.getElementById('picker');
  let target = null;

  // Alt means "this slot only". For the picker it has to be remembered from the
  // click, since the change event fires long after the key was held.
  let onlyThis = false;

  const accept = async (el, file) => {
    if (!file || !ACCEPTED.test(file.type)) {
      onError('That file is not an image or a video.');
      return;
    }
    try {
      const carried = await loadInto(el, file, onlyThis);
      onChange(el, file, carried);
    } catch (err) {
      onError(`Could not load ${file.name}: ${err.message}`);
    }
  };

  for (const el of document.querySelectorAll('[data-img],[data-slot]')) {
    el.addEventListener('click', (ev) => {
      // Clicking the view count printed over a tile should put the caret in it,
      // not open a file dialog.
      if (ev.target.isContentEditable) return;
      // A drag to reposition ends in a click; that should not open the picker.
      if (el.dataset.dragged) { delete el.dataset.dragged; return; }
      onlyThis = ev.altKey;
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
      onlyThis = ev.altKey;
      accept(el, ev.dataTransfer?.files?.[0]);
    });
  }

  picker.addEventListener('change', () => {
    const el = target;
    target = null;
    if (el) accept(el, picker.files?.[0]);
  });
}
