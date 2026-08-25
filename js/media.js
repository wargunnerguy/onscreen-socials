/* Getting pictures and footage into the slots.
 *
 * Everything becomes a data URL. That is what makes the tool work with no
 * server, and it is also what the PNG export needs: the SVG <foreignObject> the
 * export renders through cannot fetch a blob: or http: URL, so an <img src>
 * pointing at anything else would come out blank.
 */

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

async function loadInto(el, file) {
  const url = await readAsDataUrl(file);
  const isVideo = file.type.startsWith('video/');

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
  }
}

/**
 * Wire every drop target. `onChange` fires after a file lands, so the caller
 * can save. `onError` gets a message worth showing.
 */
export function initMedia({ onChange = () => {}, onError = () => {} } = {}) {
  const picker = document.getElementById('picker');
  let target = null;

  const accept = async (el, file) => {
    if (!file || !ACCEPTED.test(file.type)) {
      onError('That file is not an image or a video.');
      return;
    }
    try {
      await loadInto(el, file);
      onChange(el, file);
    } catch (err) {
      onError(`Could not load ${file.name}: ${err.message}`);
    }
  };

  for (const el of document.querySelectorAll('[data-img],[data-slot]')) {
    el.addEventListener('click', (ev) => {
      // Clicking the view count printed over a tile should put the caret in it,
      // not open a file dialog.
      if (ev.target.isContentEditable) return;
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
