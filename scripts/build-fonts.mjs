/**
 * Regenerates css/fonts.css — @font-face rules with the woff2 payload inlined
 * as base64 data URIs.
 *
 *   node scripts/build-fonts.mjs
 *
 * Why inline and not a normal font file: PNG export renders the DOM inside an
 * SVG <foreignObject>, which loads as an isolated document with no network
 * access. A @font-face pointing at a URL silently fails there and the export
 * falls back to the system font — so a PNG made on Windows would not match one
 * made on macOS. Inlining is the only way to make exports deterministic.
 * See docs/ARCHITECTURE.md.
 *
 * Why two faces per weight rather than Google's stock latin + latin-ext:
 * Google's latin-ext is ~83 KB per weight because it carries IPA, Latin
 * Extended Additional and phonetic blocks that nothing here will ever type.
 * Requesting an explicit character set with ?text= gets the same practical
 * coverage in ~8 KB. Full file drops from ~700 KB to ~220 KB.
 *
 * Inter is licensed SIL OFL 1.1, so shipping the bytes in this repo is fine.
 * fonts/OFL.txt carries the licence text.
 */
import { writeFile } from 'node:fs/promises';

const FAMILY  = 'Inter';
// 400 body · 600 buttons and handles · 700 names and stats.
// Deliberately no 800: it was used by a single rule (.fb .pname), and one extra
// weight costs ~55 KB. That rule uses 700.
const WEIGHTS = [400, 600, 700];

// Latin Extended-A letters for the languages this is plausibly used in —
// Baltic, Polish, Czech/Slovak, Hungarian, Turkish, Romanian, Croatian — plus
// the euro sign. Anything outside this and the stock latin subset falls back to
// the system font, which is documented in the README.
const EXTRA =
  'šžŠŽ' +                          // Estonian
  'āčēģīķļņūĀČĒĢĪĶĻŅŪ' +            // Latvian
  'ąėįųĄĖĮŲ' +                      // Lithuanian
  'ćłńóśźżĆŁŃÓŚŹŻ' +                // Polish
  'ďěňřťůĺľŕĎĚŇŘŤŮĹĽŔ' +            // Czech / Slovak
  'őűŐŰ' +                          // Hungarian
  'ğıİşĞŞ' +                        // Turkish
  'ășțĂȘȚ' +                        // Romanian
  'đĐ' +                            // Croatian
  '\u20AC';                         // €

// If any of these is missing from what Google returns, the subset silently lost
// a language and the build should fail loudly rather than ship a broken font.
const MUST_COVER = ['š', 'ž', 'ł', 'ő', 'ğ', 'ț', 'ā'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const get = (url) => fetch(url, { headers: { 'User-Agent': UA } });

/** Parse @font-face blocks out of a Google Fonts css2 response. */
function parse(css) {
  return [...css.matchAll(/(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g)]
    .map(([, subset, block]) => ({
      subset: subset ?? 'custom',
      weight: +block.match(/font-weight:\s*(\d+)/)[1],
      range:  block.match(/unicode-range:\s*([^;]+);/)?.[1].trim() ?? null,
      url:    block.match(/url\((https:[^)]+)\)/)[1],
    }));
}

/** Does a unicode-range string cover this character? */
function covers(range, ch) {
  const cp = ch.codePointAt(0);
  return range.split(',').some((part) => {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) return false;
    const lo = parseInt(m[1], 16);
    const hi = m[2] ? parseInt(m[2], 16) : lo;
    return cp >= lo && cp <= hi;
  });
}

const faces = [];
let total = 0;

for (const weight of WEIGHTS) {
  // 1. Google's stock "latin" subset: ASCII + all of Latin-1, so õ ä ö ü are
  //    covered along with every Western European accent.
  const stock = parse(await (await get(
    `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@${weight}&display=swap`
  )).text()).find((f) => f.subset === 'latin' && f.weight === weight);

  if (!stock) throw new Error(`no latin face for weight ${weight} — Google changed its CSS format`);

  // 2. A micro-face holding just the Latin Extended-A characters listed above.
  const extra = parse(await (await get(
    `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@${weight}` +
    `&text=${encodeURIComponent(EXTRA)}`
  )).text())[0];

  if (!extra?.range) throw new Error(`no ?text= face for weight ${weight}`);

  const missing = MUST_COVER.filter((ch) => !covers(extra.range, ch) && !covers(stock.range, ch));
  if (missing.length) throw new Error(`subset dropped required characters: ${missing.join(' ')}`);

  for (const [label, face] of [['latin', stock], ['latin-ext (curated)', extra]]) {
    const buf = Buffer.from(await (await get(face.url)).arrayBuffer());
    total += buf.length;
    console.log(`  ${FAMILY} ${weight} ${label.padEnd(20)} ${(buf.length / 1024).toFixed(1).padStart(6)} KB`);
    faces.push(
      `/* ${label} */\n` +
      `@font-face {\n` +
      `  font-family: '${FAMILY}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${weight};\n` +
      // block, not swap: a flash of Segoe UI would be captured by an export
      // fired immediately after load.
      `  font-display: block;\n` +
      `  src: url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');\n` +
      `  unicode-range: ${face.range};\n` +
      `}`
    );
  }
}

const out =
`/* GENERATED FILE — do not edit by hand.
   Regenerate with: node scripts/build-fonts.mjs

   ${FAMILY}, SIL Open Font License 1.1 — see fonts/OFL.txt
   Weights ${WEIGHTS.join(' / ')} · ${(total / 1024).toFixed(0)} KB of woff2, inlined as base64.

   Inlined rather than linked because PNG export renders inside an SVG
   <foreignObject>, which cannot fetch anything. See docs/ARCHITECTURE.md. */

${faces.join('\n\n')}
`;

await writeFile(new URL('../css/fonts.css', import.meta.url), out);
console.log(`\nwrote css/fonts.css — ${(out.length / 1024).toFixed(0)} KB`);
