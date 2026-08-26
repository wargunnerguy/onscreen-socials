/* PNG export.
 *
 * The phone is real DOM at real pixel size, so exporting is: clone the node,
 * wrap it in an <svg><foreignObject>, load that as an image, draw it to a
 * canvas at 1:1, hand back a blob.
 *
 * That isolated SVG document cannot fetch anything — no stylesheets, no fonts,
 * no remote images. Everything it needs has to be inlined:
 *   · CSS is fetched once at boot and injected as a <style> (loadStyles below)
 *   · Inter is base64 inside css/fonts.css (scripts/build-fonts.mjs)
 *   · dropped media is already a data URL, courtesy of FileReader
 *
 * The canvas starts transparent and nothing paints a page background into the
 * clone, so the area outside the phone's rounded corners comes out with a real
 * alpha channel. The green backdrop is preview only. Compositing over anything
 * needs no keying.
 */

const NAMES = ['instagram', 'facebook', 'tiktok'];

/* Custom properties the UI changes at runtime. css/app.css declares these on
 * :root, and inside a <foreignObject> :root matches the <svg> element — so the
 * injected stylesheet would otherwise reimpose its defaults and every export
 * would come out at the stock 25% dim no matter where the slider was. Copying
 * the live values onto the wrapper, which is an ancestor of the clone, wins. */
const LIVE_VARS = ['--scr-w', '--scr-h', '--scr-r', '--bez', '--dim'];

let cssText = null;

/** Fetch the stylesheets as text so they can be inlined at export time. */
export async function loadStyles(hrefs = ['css/fonts.css', 'css/app.css']) {
  const parts = await Promise.all(hrefs.map(async (href) => {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`${href}: ${res.status}`);
    return res.text();
  }));
  cssText = parts.join('\n');
}

/**
 * Can this browser rasterise a foreignObject at all?
 * Firefox and Safari each fall over on some part of this path, and finding out
 * after the shot is set up is worse than being told at the start.
 */
export async function probe() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">' +
    '<foreignObject width="4" height="4">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" style="width:4px;height:4px;background:#f00"></div>' +
    '</foreignObject></svg>';

  try {
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data;
    return r > 200 && g < 60 && b < 60;
  } catch {
    return false;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

/**
 * Videos cannot cross into the SVG document, so each one is replaced by a still
 * of its current frame. Walks the clone and the source in parallel — cloneNode
 * preserves order, so index i matches.
 */
function freezeVideos(clone, src) {
  const source = src.querySelectorAll('video');
  const copies = clone.querySelectorAll('video');

  copies.forEach((node, i) => {
    const v = source[i];
    const c = document.createElement('canvas');
    c.width = v?.videoWidth || 16;
    c.height = v?.videoHeight || 9;
    try {
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    } catch {
      // Not enough of the video has decoded yet; a blank frame beats a crash.
    }
    const im = document.createElement('img');
    im.setAttribute('src', c.toDataURL('image/png'));
    im.setAttribute('style', `width:100%;height:100%;object-fit:${v ? getComputedStyle(v).objectFit : 'cover'}`);
    node.replaceWith(im);
  });
}

/** Render phone `idx` and return { blob, filename, width, height }. */
export async function renderPhone(idx, { slug, withFrame = true } = {}) {
  if (cssText === null) throw new Error('loadStyles() has not finished');

  const phone = document.querySelectorAll('.phone')[idx];
  const src = withFrame ? phone : phone.querySelector('.screen');
  const w = src.offsetWidth;
  const h = src.offsetHeight;

  const clone = src.cloneNode(true);
  freezeVideos(clone, src);
  clone.querySelectorAll('.guide').forEach((g) => g.remove());

  // Body classes carry the view state (noframe, nostatus, fit-*, bleed, ttbig,
  // watermark). 'guides' is dropped — measurement overlays are not artwork.
  const classes = [...document.body.classList].filter((c) => c !== 'guides');
  classes.push('clean');

  const wrap = document.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrap.setAttribute('class', classes.join(' '));
  wrap.style.width = `${w}px`;
  wrap.style.height = `${h}px`;

  const root = getComputedStyle(document.documentElement);
  for (const name of LIVE_VARS) {
    wrap.style.setProperty(name, root.getPropertyValue(name).trim());
  }

  const style = document.createElement('style');
  style.textContent = cssText;
  wrap.append(style, clone);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    new XMLSerializer().serializeToString(wrap) +
    '</foreignObject></svg>';

  // The main document having the font decoded does not load it inside the SVG,
  // but it does mean the bytes are warm and the base64 face resolves promptly.
  await document.fonts.ready;
  // A data-URI image still decodes asynchronously, and until it does it has no
  // intrinsic size — a logo dropped a moment ago would lay out at zero width.
  await Promise.all([...src.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));

  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  // One frame of slack: onload fires when the SVG is parsed, which is not always
  // after its @font-face data URIs have been applied.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas produced no blob'))), 'image/png');
  });

  return { blob, filename: `${slug}-${NAMES[idx]}.png`, width: w, height: h };
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const platformName = (idx) => NAMES[idx];
export const platformCount = NAMES.length;
