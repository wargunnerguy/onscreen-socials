/* Platform chrome icons.
 *
 * Why these exist: the original markup drew its chrome with emoji and fullwidth
 * characters (♡ 💬 ↪ 🔖 ＋ ☰ ⌕ ⋯ ✉ ‹ ▾). Those rasterise from whatever emoji font
 * the operating system ships, so the same export made on Windows and on macOS
 * came out visibly different. For a tool whose only output is a PNG that has to
 * match across machines, that is the single worst detail in the file.
 *
 * Generic geometry only — no platform marks. Recognition comes from colour and
 * layout, which is a deliberate decision recorded in docs/ARCHITECTURE.md.
 *
 * Markup writes <i data-icon="heart"></i>; expand() swaps in the real <svg>.
 * They have to end up as live SVG nodes rather than a <use> reference to a
 * sprite, because export.js serialises a cloned subtree into a standalone SVG
 * document where a <use href="#id"> pointing outside that subtree resolves to
 * nothing.
 */

/* 24×24 viewBox. Stroked unless the name ends in -solid; see .ic in css/app.css. */
const PATHS = {
  /* — shared — */
  'chevron-down':  '<path d="M6 9.5 12 15.5 18 9.5"/>',
  'chevron-left':  '<path d="M15 18.5 8.5 12 15 5.5"/>',
  'more':          '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
  'search':        '<circle cx="11" cy="11" r="7.2"/><path d="M16.4 16.4 21 21"/>',
  'plus':          '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  'play-solid':    '<path d="M8 5v14l11-7z"/>',
  'globe':         '<circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8c2.4 2.5 3.7 5.8 3.7 9.2s-1.3 6.7-3.7 9.2c-2.4-2.5-3.7-5.8-3.7-9.2S9.6 5.3 12 2.8Z"/>',
  'link':          '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"/>',

  /* — Instagram — */
  'plus-square':   '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.4"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
  'menu':          '<path d="M3.6 6.5h16.8M3.6 12h16.8M3.6 17.5h16.8"/>',
  'heart':         '<path d="M20.5 5.9a5 5 0 0 0-7.1 0L12 7.3l-1.4-1.4a5 5 0 1 0-7.1 7.1l1.4 1.4L12 21.5l7.1-7.1 1.4-1.4a5 5 0 0 0 0-7.1Z"/>',
  'heart-solid':   '<path d="M20.5 5.9a5 5 0 0 0-7.1 0L12 7.3l-1.4-1.4a5 5 0 1 0-7.1 7.1l1.4 1.4L12 21.5l7.1-7.1 1.4-1.4a5 5 0 0 0 0-7.1Z"/>',
  'comment':       '<path d="M21 11.6a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.9L3.4 20.6l1.5-4.8A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.4Z"/>',
  'send':          '<path d="M21.4 2.6 10.6 13.4"/><path d="M21.4 2.6 14.6 21.4l-4-8.8-8.8-4Z"/>',
  'bookmark':      '<path d="M19 21.2 12 16.2 5 21.2V4.8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',

  /* — Facebook — */
  'thumb-up':      '<path d="M7 10.8h2.6l3.2-7.3a2.6 2.6 0 0 1 2.6 2.6v3.1h4.2a1.9 1.9 0 0 1 1.9 2.2l-1.3 7.4a2.2 2.2 0 0 1-2.2 1.8H7Z"/><rect x="2.2" y="10.8" width="4.8" height="9.8" rx="1.4"/>',
  'share':         '<path d="M4.2 12.4v7.2a1.8 1.8 0 0 0 1.8 1.8h12a1.8 1.8 0 0 0 1.8-1.8v-7.2"/><path d="M16 6.6 12 2.6 8 6.6M12 2.6v13"/>',

  /* — TikTok — */
  'mail':          '<rect x="2.4" y="4.6" width="19.2" height="14.8" rx="2.2"/><path d="M2.9 6 12 12.6 21.1 6"/>',
  'grid-solid':    '<rect x="2" y="3" width="6" height="8" rx="1"/><rect x="9" y="3" width="6" height="8" rx="1"/><rect x="16" y="3" width="6" height="8" rx="1"/><rect x="2" y="13" width="6" height="8" rx="1"/><rect x="9" y="13" width="6" height="8" rx="1"/><rect x="16" y="13" width="6" height="8" rx="1"/>',
  'lock-solid':    '<path d="M6 10V7a6 6 0 0 1 12 0v3h1.5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1H6zm2 0h8V7a4 4 0 0 0-8 0v3z"/>',
};

/** Build one icon element. `name` may carry extra classes: "heart thin". */
export function icon(name) {
  const [key, ...extra] = name.trim().split(/\s+/);
  const d = PATHS[key];
  if (!d) throw new Error(`unknown icon "${key}"`);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', ['ic', key.endsWith('-solid') && 'solid', ...extra].filter(Boolean).join(' '));
  // aria-hidden: these are decoration next to text that already says the same thing.
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = d;
  return svg;
}

/** Replace every <i data-icon="…"> under `root` with its SVG. */
export function expandIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-icon]')) {
    el.replaceWith(icon(el.dataset.icon));
  }
}
