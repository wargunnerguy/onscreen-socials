/* Compositing the screen into a photographed device frame.
 *
 * The CSS phone is a drawn approximation: a gradient, a rounded rectangle and an
 * inset highlight. Good enough to judge a layout against, not good enough to
 * pass as a real handset in a shot. Supplying a photograph of an iPhone with a
 * transparent screen aperture, plus a mask for the screen itself, gets you the
 * real thing — glass edges, reflections, the lot.
 *
 * Two images:
 *   frame  the device with the screen area transparent, drawn over everything
 *   mask   opaque wherever screen should show through, transparent elsewhere;
 *          same pixel dimensions as the frame
 *
 * Where the screen goes is read from the mask rather than configured: the
 * bounding box of its opaque pixels is the aperture. That means any device at
 * any resolution works with no numbers to enter, and the two files are the only
 * thing anyone has to get right.
 */

import { isLocal } from './env.js';

const FILES = { frame: 'assets/device-frame.png', mask: 'assets/device-mask.png' };

let device = null;          // { frame, mask, box } once both images are in

export function hasDevice() { return device !== null; }
export function deviceSize() {
  return device ? { width: device.frame.width, height: device.frame.height } : null;
}
export function apertureBox() { return device?.box ?? null; }

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** The bounding box of everything not fully transparent in the mask. */
function opaqueBounds(mask) {
  const c = document.createElement('canvas');
  c.width = mask.width;
  c.height = mask.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(mask, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('the mask has no opaque area — nothing to show the screen through');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Try to load the pair. Returns a short description on success, null if the
 * files are simply not there, and throws only if they are there and unusable.
 */
export async function loadDevice(files = FILES) {
  // assets/ is gitignored, so on a deployed site there is nothing to find and
  // asking would only litter the console. See js/env.js.
  if (files === FILES && !isLocal()) return null;

  let frame;
  let mask;
  try {
    [frame, mask] = await Promise.all([loadImage(files.frame), loadImage(files.mask)]);
  } catch {
    device = null;
    return null;                    // not supplied; the CSS frame stays in charge
  }

  if (frame.width !== mask.width || frame.height !== mask.height) {
    device = null;
    throw new Error(
      `frame is ${frame.width}×${frame.height} but mask is ${mask.width}×${mask.height} — they must match`
    );
  }

  device = { frame, mask, box: opaqueBounds(mask) };
  return `${frame.width}×${frame.height}, screen ${device.box.width}×${device.box.height}`;
}

/**
 * Paint a rendered screen into the device.
 *
 * `screenImage` is the bare screen at its own resolution; it is scaled to the
 * aperture, clipped to the mask so rounded corners and the island come out
 * exactly as the mask draws them, then the frame goes over the top.
 */
export function composite(screenImage) {
  if (!device) throw new Error('no device frame loaded');
  const { frame, mask, box } = device;

  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(screenImage, box.x, box.y, box.width, box.height);
  // Keep only what the mask says is screen. Everything outside becomes
  // transparent, which is what leaves the corners clean.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(frame, 0, 0);

  return canvas;
}
