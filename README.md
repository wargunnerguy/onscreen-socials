# Onscreen Socials

**Social profile mockups for video.**

Three phone screens side by side — Instagram, Facebook Page, TikTok — each showing a
profile header and one video slot. Built for compositing into video, where the profile
name and the follower count have to read clearly for three seconds and the post
underneath is set dressing.

Drop in your own footage, retype the numbers, export a PNG at true iPhone resolution with
transparent corners. Runs entirely in the browser: no account, no upload, nothing leaves
the machine.

![Three phone mockups side by side in the editor](docs/screenshot.png)

---

## Run it

It is a static site, so any web server will do:

```bash
npx serve .          # or: python -m http.server
```

Then open the address it prints.

Opening `index.html` straight off disk will *not* work — the page uses ES modules and
loads its accounts with `fetch`, and browsers block both on `file://`. That is the one
cost of the layout; a local server is a single command.

## Use it

- **Click any text** to edit it. Changes save as you type. Text is kept in localStorage
  and images in IndexedDB, so large covers and screenshots survive a reload; videos are
  session-only.
- **Drop an image or a video** on an avatar, a cover, a TikTok tile or a video slot.
  Click one to open a file picker instead.
- **One profile picture serves every avatar** — the three profile headers and the two
  post rows. Drop it once. Hold **Alt** while dropping (or while clicking to pick) to give
  a single slot its own picture; it stops following until you drop on it again without Alt.
- **Export** writes a PNG per platform. `All three` does the set.
- **Save…** writes the accounts back out as a `.json` you can send to someone.
- **Platform logos**: each phone's top bar starts with an empty slot — drop an Instagram,
  Facebook or TikTok logo on it. Colour and layout alone do not tell an audience which
  app they are looking at.
- **Drag the Facebook cover** up or down to reposition it, the way Facebook does;
  double-click to put it back at the top. The position saves with the image.
- **One big video (all platforms)** under More ▾ turns the post into a single full
  portrait video on each phone. With Bleed on it runs off the bottom edge; with Bleed off
  it fits the space left.
- **TikTok: one wall image** under More ▾ swaps the nine-cell grid for a single drop
  area — screenshot the whole profile grid and drop it once, instead of sourcing nine
  thumbnails. It fills the width and runs off the bottom edge.
- **Clock** under More ▾ sets the status-bar time on all three phones, for every
  account. Typing into a status bar does the same thing.
- **Reset** discards edits for the selected account; **Clear saved edits** under More ▾
  discards everything and forgets any preset opened with Load…
- **`H`** hides the toolbar for a clean screen capture.
- **More ▾** holds the fiddly controls: Facebook dark mode, TikTok big tile, bleed, dim,
  slot guides, and the prop watermark.

### What comes out

| | With frame | Without frame |
|---|---|---|
| Instagram / Facebook / TikTok | 1250 × 2666 | 1206 × 2622 |

1206 × 2622 is the iPhone 17's native panel. Everything on screen is real DOM at real
pixel size — the zoom slider is a preview transform and does not touch what is exported.

The area outside the phone's rounded corners is **genuinely transparent**, so the PNG
composites over anything without keying. The green backdrop in the editor is there to
judge contrast against, not to key out — though it is one click away if a green plate is
what your pipeline wants.

**Slot guides** print each video slot's true position and size inside the 1206 × 2622
screen, which is what you need to line footage up in an editor.

## Accounts

Accounts live in `presets/*.json`, not in the code:

```json
{
  "version": 1,
  "accounts": {
    "cafe": {
      "label": "Kohvik Null",
      "slug": "kohvik-null",
      "fields": { "igHandle": "kohviknull", "igFollowers": "6,241" },
      "media":  { "ig-avatar": { "t": "bg", "s": "url(data:image/png;base64,…)" } }
    }
  }
}
```

Every key under `fields` matches a `data-f` attribute in `index.html`. Anything you leave
out falls back to the markup default and anything unrecognised is ignored, so a partial
file is fine. `slug` names the exported PNGs.

`lang` is optional and sets the language of the phone's own interface — the stats
labels, buttons and tab rows (`"et"` or `"en"`, default English). Bios, captions and
follower counts are account data and stay in `fields`; only the words the platforms
themselves render come from `lang`. Add a language by extending `js/strings.js`.

`media` is optional and holds avatars and covers, keyed by the `data-mid` attributes in
`index.html` (`ig-avatar`, `fb-cover`, `tt-cell-3`, …). Images are embedded as data URLs
so a preset is one self-contained file. Only `data:` URLs are accepted when loading — a
preset that pointed at a remote image would phone home the moment someone opened it.

**You do not have to write these by hand.** Set the accounts up in the editor, then
**Save…** → *All accounts* or *This one only*. The file that comes out is what is on
screen — your edits, not the preset they started from — and the panel shows how big it
will be before you download it. Images are included by default; untick that if you need
the file small enough to email. Videos are always left out, because they are session-only
everywhere else in the tool.

That file is the unit of sharing: hand it to someone, they press **Load…**, and they have
your accounts, avatars and all.

`presets/example.json` is a worked example. To add your own permanently, put the file next
to it and list it in `presets/index.json`; otherwise **Load…** is enough — a hand-loaded
preset is remembered in that browser, which is how you get private accounts onto a
deployed copy without committing them.

`presets/local.json` is gitignored and loaded automatically **when you are running the
site locally**. That is the place for account sets you do not want on GitHub. A deployed
copy does not look for it — there, use **Load…** once and the browser remembers it.

> Edited a preset file and nothing changed? Your browser is holding saved edits that
> layer on top of it. Reset that account, or use **Clear saved edits**.

> Field values are inserted as HTML so that `<br>` and `<b>` work in bios and captions.
> Only open preset files you trust.

## Browser support

Export needs Chrome or Edge. It renders the page through an SVG `<foreignObject>` and
rasterises that to a canvas; Firefox and Safari each drop parts of that path. The page
checks at start-up and says so rather than letting you set up a shot and then fail.
Everything except export works anywhere.

Text you type is rendered in **Inter**, which is bundled, so exports look identical on
every machine. Emoji are the exception — those come from the operating system's own emoji
font, so a bio with 🐜 in it will not match between Windows and macOS. If you need
byte-identical output across machines, avoid emoji in the editable text.

## Logos

The tool ships **no platform logos**. Colour and layout carry the recognition, which keeps
this project clear of Meta's and ByteDance's trademarks and is why the repository contains
no marks of theirs.

For an audience that is shown a screen for three seconds, that is not always enough, so
each top bar has a slot you can drop your own logo file into. Those live in your browser,
apply to every account, and are deliberately **not** written into preset files — a preset
gets emailed around and committed, and trademarked artwork should not travel with it.

A mark cut for one background disappears on another — a black TikTok wordmark on TikTok'''s
black bar most of all. **Logo style** under More ▾ handles that: *Adapt to bar* silhouettes
the logo white on the dark bars and black on Facebook'''s white one, and *On a white chip*
keeps the original colours and puts a white pad behind them, which is what a gradient mark
like Instagram'''s needs. Both survive into the export. The tidiest answer is still to use
the platform'''s own light-background variant where one exists.

If you publish the result, the usual rules apply: use the marks to identify the real
platform, do not restyle them, and do not imply the platform endorsed you.

## What this is for

Props and set dressing for production: a believable phone screen in the background of a
shot, on a laptop in a scene, in a title sequence. It is not a way to fabricate
convincing evidence that an account said or did something, and the **prop watermark**
toggle under More ▾ exists for demos and pitch decks where that distinction matters.

No platform logos are reproduced anywhere — colour and layout carry the recognition, and
that is deliberate. Please keep it that way if you send a patch.

## Repository layout

```
index.html              markup: toolbar, three phones
css/app.css             everything visual (also injected into the export)
css/fonts.css           GENERATED — Inter as base64; node scripts/build-fonts.mjs
js/app.js               boot and wiring
js/presets.js           account loading
js/state.js             edits, persistence, migration
js/media.js             drag-and-drop and file picking
js/export.js            foreignObject → canvas → PNG
js/icons.js             inline SVG chrome icons
presets/                account files; local.json is gitignored
docs/ARCHITECTURE.md    why the awkward parts are the way they are
```

Read `docs/ARCHITECTURE.md` before changing the export path or the CSS — several things
that look redundant are load-bearing.

## Deploy

GitHub Pages serves this as-is:

1. Push to `main`.
2. Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

For a custom subdomain: add a `CNAME` file at the repo root containing the hostname, point
a DNS `CNAME` record at `<user>.github.io`, then turn on *Enforce HTTPS* once the
certificate is issued. Once the site has a URL, add absolute `og:url` and `og:image` tags
to `index.html` — they are deliberately left out until then, because relative ones do not
work for link previews.

## Licence

Code: [MIT](LICENSE).
Inter is bundled under the [SIL Open Font License 1.1](fonts/OFL.txt).
