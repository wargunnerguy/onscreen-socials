/* Onscreen Socials — boot and wiring.
 *
 * Loads accounts, paints one into the three phones, and connects the control
 * bar. Everything that has real logic lives in a sibling module; this file is
 * meant to stay readable as a table of contents.
 */

import { expandIcons } from './icons.js';
import { loadAll, validate, cache, clearCache, buildDoc } from './presets.js';
import * as state from './state.js';
import { initMedia } from './media.js';
import { applyLang, DEFAULT_LANG } from './strings.js';
import { loadLogos, initLogos } from './logos.js';
import { initReposition } from './cover.js';
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

function presetFor(key) { return accounts[key] ?? {}; }

/* Paint an account, chrome language included. The stats labels and buttons
 * belong to the phone's interface rather than the account, so they come from
 * js/strings.js keyed on the preset's "lang". */
function show(key) {
  applyLang(accounts[key]?.lang ?? DEFAULT_LANG);
  state.restore(key, presetFor(key));
}
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
  show(current);
}

entity.addEventListener('change', () => switchTo(entity.value));

$('resetBtn').addEventListener('click', () => {
  if (!state.hasEdits(current)) { flash('nothing to reset'); return; }
  if (!confirm(`Discard all edits for "${accounts[current].label}"?`)) return;
  state.clearEdits(current);
  show(current);
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

/* Write accounts back out to a preset file — the counterpart to Load…, and the
 * way a set of accounts gets sent to someone else. What is written is what is on
 * screen: this browser's edits layered over whatever preset they came from. */
const saveScope = $('saveScope');
const saveMedia = $('saveMedia');
const saveSize = $('saveSize');
const savePanel = document.querySelector('.more.save');

function currentDoc() {
  state.capture(current);
  const keys = saveScope.value === 'one' ? [current] : Object.keys(accounts);
  return buildDoc(accounts, keys, state.merged, {
    includeMedia: saveMedia.checked,
    name: saveScope.value === 'one' ? accounts[current]?.label : 'Onscreen Socials accounts',
  });
}

function describeSize() {
  const { doc, videos } = currentDoc();
  const json = JSON.stringify(doc);
  const n = Object.keys(doc.accounts).length;
  const mb = json.length / 1_048_576;
  const size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(json.length / 1024))} KB`;

  const notes = [`${n} account${n === 1 ? '' : 's'} · ${size}`];
  if (videos) notes.push(`${videos} video${videos === 1 ? '' : 's'} left out — video is session-only.`);
  // Anything past a few MB is awkward to email and slow to load back.
  saveSize.classList.toggle('warn', mb > 5 || videos > 0);
  if (mb > 5) notes.push('Large. Untick images to make it small enough to send.');

  saveSize.textContent = notes.join(' ');
}

savePanel.addEventListener('toggle', () => { if (savePanel.open) describeSize(); });
saveScope.addEventListener('change', describeSize);
saveMedia.addEventListener('change', describeSize);

$('saveGo').addEventListener('click', () => {
  const { doc } = currentDoc();
  const name = saveScope.value === 'one'
    ? `onscreen-socials-${slugFor(current)}.json`
    : 'onscreen-socials-accounts.json';

  download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), name);
  savePanel.open = false;
  flash(`saved ${name}`);
});

/* Saved edits layer over the preset, which is what you want while working but
 * means an edited field keeps winning after the preset file changes underneath
 * it. Reset does one account; this drops the lot. */
let wiping = false;

$('wipeBtn').addEventListener('click', () => {
  const warning = [
    'Discard saved edits for every account, and forget any preset opened with Load…?',
    '',
    'The preset files themselves are not touched.',
  ].join('\n');
  if (!confirm(warning)) return;
  // The reload below fires beforeunload, which would otherwise persist the
  // still-displayed account straight back into the storage just emptied.
  wiping = true;
  Promise.all([state.clearAll(), clearCache()]).then(() => location.reload());
});

/* ───────────────────────── saving ───────────────────────── */

let saveTimer;
document.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => state.persist(current), 700);
});
window.addEventListener('beforeunload', () => {
  if (wiping) return;
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

/* Every control also has to be applied once at start-up, not only when it
 * changes. Browsers restore form state across a reload, so a checkbox can come
 * back ticked differently from the markup default while the view still reflects
 * the markup — the toolbar and the phones then quietly disagree.
 *
 * These also tolerate a missing element: a stale cached index.html against fresh
 * JS would otherwise throw here and take the whole module down, leaving a page
 * that looks broken for a reason nothing explains. */
const syncers = [];

const toggleClass = (id, cls, invert = false, settle = false) => {
  const el = $(id);
  if (!el) return;
  const apply = () => {
    body.classList.toggle(cls, invert ? !el.checked : el.checked);
    // Frame, status bar and bleed all change how tall the stage is, so the
    // wrapper height has to be recomputed, not just the guide readouts.
    settle ? setTimeout(applyZoom, 30) : applyZoom();
  };
  el.addEventListener('change', apply);
  syncers.push(apply);
};

toggleClass('frameChk', 'noframe', true);
toggleClass('statusChk', 'nostatus', true);
toggleClass('guideChk', 'guides');
// Ticked means bleed ON, matching the body class the markup ships with.
// This was inverted, which only showed once controls were synced at boot.
toggleClass('bleedChk', 'bleed', false, true);
toggleClass('ttBig', 'ttbig', false, true);
toggleClass('ttWall', 'ttwall', false, true);
toggleClass('bigVid', 'bigvideo', false, true);
toggleClass('markChk', 'watermark');
toggleClass('logoChk', 'nologo', true);

const on = (id, event, handler) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener(event, () => handler(el));
  syncers.push(() => handler(el));
};

on('fbDark', 'change', (el) => $('fbScreen').classList.toggle('dark', el.checked));

/* A logo cut for a white background disappears on a black one. */
on('logoStyle', 'change', (el) => {
  body.classList.remove('logo-adapt', 'logo-chip');
  if (el.value) body.classList.add(el.value);
});

on('fitSel', 'change', (el) => {
  body.classList.remove('fit-blur', 'fit-letter', 'fit-crop');
  body.classList.add(el.value);
});

on('dim', 'input', (el) => {
  document.documentElement.style.setProperty('--dim', el.value / 100);
  $('dimVal').textContent = `${el.value}%`;
});

/** Bring the view into line with whatever the controls currently say. */
function syncControls() {
  for (const fn of syncers) fn();
}

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
  onChange: (el, file, carried) => {
    state.persist(current);
    if (carried) flash(`applied to ${carried + 1} avatar slots`);
  },
  onError: (msg) => alert(msg),
});

/* Logos are global rather than per-account, so they are not part of the preset
 * and survive Clear saved edits. See js/logos.js. */
initLogos({ onStatus: flash });

/* The Facebook cover can be dragged vertically, the way Facebook lets you
 * reposition one. The offset is saved with the image. */
initReposition({ onChange: () => { state.persist(current); flash('cover moved'); } });

/* ───────────────────────── boot ───────────────────────── */

async function boot() {
  expandIcons();
  await state.load();
  loadLogos();

  const { accounts: found, problems } = await loadAll();
  accounts = found;

  current = Object.keys(accounts)[0];
  fillAccountList(current);
  show(current);

  syncControls();
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
