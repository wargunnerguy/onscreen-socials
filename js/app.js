/* Onscreen Socials — boot and wiring.
 *
 * Loads accounts, paints one into the three phones, and connects the control
 * bar. Everything that has real logic lives in a sibling module; this file is
 * meant to stay readable as a table of contents.
 */

import { expandIcons } from './icons.js';
import { loadAll, validate, cache } from './presets.js';
import * as state from './state.js';
import { initMedia } from './media.js';
import { loadStyles, probe, renderPhone, download, platformCount } from './export.js';

const body = document.body;
const stage = document.getElementById('stage');
const $ = (id) => document.getElementById(id);

let accounts = {};
let current = null;
let scale = 0.22;

/* ───────────────────────── status line ───────────────────────── */

const saveState = $('saveState');
let statusTimer;

function flash(msg) {
  saveState.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveState.textContent = ''; }, 2400);
}
state.onSaveStatus(flash);

const notice = $('notice');
function showNotice(html) {
  notice.innerHTML = html;
  notice.hidden = false;
}

/* ───────────────────────── accounts ───────────────────────── */

const entity = $('entity');

function fieldsFor(key) { return accounts[key]?.fields ?? {}; }
function slugFor(key) { return accounts[key]?.slug ?? 'mockup'; }

function fillAccountList(selected) {
  entity.replaceChildren(...Object.entries(accounts).map(([key, acc]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = acc.label;
    return opt;
  }));
  entity.value = selected;
}

function switchTo(key) {
  if (current) state.persist(current);
  current = key;
  state.restore(current, fieldsFor(current));
}

entity.addEventListener('change', () => switchTo(entity.value));

$('resetBtn').addEventListener('click', () => {
  if (!state.hasEdits(current)) { flash('nothing to reset'); return; }
  if (!confirm(`Discard all edits for "${accounts[current].label}"?`)) return;
  state.clearEdits(current);
  state.restore(current, fieldsFor(current));
  state.persist(current);
});

/* Load a preset by hand. Also caches it, so a preset that is not deployed
 * alongside the site (presets/local.json is gitignored) survives a reload. */
const presetPicker = $('presetPicker');
$('loadBtn').addEventListener('click', () => { presetPicker.value = ''; presetPicker.click(); });

presetPicker.addEventListener('change', async () => {
  const file = presetPicker.files?.[0];
  if (!file) return;
  try {
    const doc = JSON.parse(await file.text());
    const loaded = validate(doc, file.name);
    Object.assign(accounts, loaded);
    cache(doc);
    const first = Object.keys(loaded)[0];
    fillAccountList(first ?? current);
    if (first) switchTo(first);
    flash(`loaded ${Object.keys(loaded).length} account(s)`);
  } catch (err) {
    alert(`Could not load ${file.name}\n\n${err.message}`);
  }
});

/* ───────────────────────── saving ───────────────────────── */

let saveTimer;
document.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => state.persist(current), 700);
});
window.addEventListener('beforeunload', () => {
  try { state.persist(current); } catch { /* nothing useful to do while unloading */ }
});

/* ───────────────────────── backdrop ───────────────────────── */

/* Preview only — the export carries a real alpha channel, so the green is a
 * convenience for judging contrast, not a key colour to composite against. */
const COLOURS = [
  ['#101014', 'Dark'],
  ['#00B140', 'Green screen'],
  ['#0047BB', 'Blue screen'],
  ['#ffffff', 'White'],
  ['#f0f2f5', 'Light grey'],
];

const swatches = $('swatches');
COLOURS.forEach(([hex, name], i) => {
  const sw = document.createElement('span');
  sw.className = i === 0 ? 'sw on' : 'sw';
  sw.style.background = hex;
  sw.title = name;
  sw.addEventListener('click', () => {
    body.style.background = hex;
    swatches.querySelectorAll('.sw').forEach((x) => x.classList.remove('on'));
    sw.classList.add('on');
    measure();
  });
  swatches.append(sw);
});

/* ───────────────────────── view toggles ───────────────────────── */

const toggleClass = (id, cls, invert = false, settle = false) => {
  $(id).addEventListener('change', (e) => {
    body.classList.toggle(cls, invert ? !e.target.checked : e.target.checked);
    // Frame, status bar and bleed all change how tall the stage is, so the
    // wrapper height has to be recomputed, not just the guide readouts.
    settle ? setTimeout(applyZoom, 30) : applyZoom();
  });
};

toggleClass('frameChk', 'noframe', true);
toggleClass('statusChk', 'nostatus', true);
toggleClass('guideChk', 'guides');
toggleClass('bleedChk', 'bleed', true, true);
toggleClass('ttBig', 'ttbig', false, true);
toggleClass('markChk', 'watermark');

$('fbDark').addEventListener('change', (e) => {
  $('fbScreen').classList.toggle('dark', e.target.checked);
});

$('fitSel').addEventListener('change', (e) => {
  body.classList.remove('fit-blur', 'fit-letter', 'fit-crop');
  body.classList.add(e.target.value);
});

const dim = $('dim');
dim.addEventListener('input', () => {
  document.documentElement.style.setProperty('--dim', dim.value / 100);
  $('dimVal').textContent = `${dim.value}%`;
});

const zoom = $('zoom');
const stagewrap = $('stagewrap');
const bar = $('bar');

// The bar wraps on a narrow window; the stage offset follows whatever height it
// actually ends up with.
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
  applyZoom();
}).observe(bar);

function applyZoom() {
  scale = zoom.value / 100;
  stage.style.transform = `scale(${scale})`;
  $('zoomVal').textContent = `${zoom.value}%`;

  // A transform does not shrink the layout box, so without this the document
  // stays 2666px tall at every zoom and the page scrolls over dead space.
  const pad = parseFloat(getComputedStyle(stagewrap).paddingTop)
            + parseFloat(getComputedStyle(stagewrap).paddingBottom);
  stagewrap.style.height = `${Math.round(stage.offsetHeight * scale + pad)}px`;

  measure();
}
zoom.addEventListener('input', applyZoom);

/* Slot guides read out the slot's true pixel geometry inside the 1206×2622
 * screen, which is what a compositor needs to line footage up. Measuring the
 * scaled boxes and dividing back out is how those numbers stay honest. */
function measure() {
  if (!body.classList.contains('guides')) return;
  for (const slot of document.querySelectorAll('.vslot')) {
    const a = slot.getBoundingClientRect();
    const b = slot.closest('.screen').getBoundingClientRect();
    const x = Math.round((a.left - b.left) / scale);
    const y = Math.round((a.top - b.top) / scale);
    const w = Math.round(a.width / scale);
    const h = Math.round(a.height / scale);
    const visible = Math.max(0, Math.min(h, 2622 - y));
    slot.querySelector('.guide span').innerHTML =
      `${w} &times; ${h}<br>x ${x} &nbsp; y ${y}` +
      (visible < h ? `<br>visible ${visible}px` : '');
  }
}
window.addEventListener('resize', measure);

document.addEventListener('keydown', (e) => {
  if ((e.key === 'h' || e.key === 'H') && !document.activeElement?.isContentEditable) {
    body.classList.toggle('clean');
    applyZoom();
  }
});

/* ───────────────────────── export ───────────────────────── */

const exportButtons = [...document.querySelectorAll('[data-ex]'), $('exAll')];

async function runExport(indices) {
  exportButtons.forEach((b) => { b.disabled = true; });
  const slug = slugFor(current);
  try {
    for (const idx of indices) {
      const { blob, filename } = await renderPhone(idx, { slug, withFrame: $('withFrame').checked });
      download(blob, filename);
      // Chrome throttles a burst of programmatic downloads; a beat between them
      // is the difference between three files and one.
      if (indices.length > 1) await new Promise((r) => setTimeout(r, 350));
    }
    flash(indices.length > 1 ? 'exported 3 files' : 'exported');
  } catch (err) {
    alert(`Export failed.\n\n${err.message}\n\nChrome or Edge handles this most reliably.`);
  } finally {
    exportButtons.forEach((b) => { b.disabled = false; });
  }
}

document.querySelectorAll('[data-ex]').forEach((b) => {
  b.addEventListener('click', () => runExport([Number(b.dataset.ex)]));
});
$('exAll').addEventListener('click', () => runExport([...Array(platformCount).keys()]));

/* ───────────────────────── media ───────────────────────── */

initMedia({
  onChange: () => state.persist(current),
  onError: (msg) => alert(msg),
});

/* ───────────────────────── boot ───────────────────────── */

async function boot() {
  expandIcons();
  state.load();

  const { accounts: found, problems } = await loadAll();
  accounts = found;

  current = Object.keys(accounts)[0];
  fillAccountList(current);
  state.restore(current, fieldsFor(current));

  applyZoom();

  if (problems.length) {
    showNotice(
      `<strong>Presets did not load.</strong> ${problems.join('; ')}. ` +
      'Opening index.html straight off disk does this — serve the folder instead ' +
      '(<code>npx serve .</code>), or use <strong>Load…</strong> to pick a preset file. ' +
      'The built-in demo account still works.'
    );
  }

  try {
    await loadStyles();
  } catch (err) {
    exportButtons.forEach((b) => { b.disabled = true; });
    showNotice(`<strong>Export is unavailable.</strong> Stylesheets could not be read (${err.message}).`);
    return;
  }

  if (!await probe()) {
    exportButtons.forEach((b) => { b.disabled = true; });
    showNotice(
      '<strong>This browser cannot export.</strong> PNG export renders the page through an ' +
      'SVG foreignObject, which Chrome and Edge support and this browser does not. ' +
      'Everything else on the page works.'
    );
  } else if (!window.chrome) {
    showNotice(
      '<strong>Export may not match.</strong> Chrome and Edge render this the most ' +
      'faithfully; other browsers can drop effects. Check the PNG before using it.'
    );
  }
}

boot();
