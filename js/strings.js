/* Interface language for the phone chrome.
 *
 * The stats labels, buttons and tab rows are part of the phone's own interface,
 * not the account — a viewer in Tallinn sees "jälgijat", not "followers". They
 * are marked up as <… data-ui="key"> and filled in from here.
 *
 * An account picks its language with "lang" in the preset; anything without one
 * gets English. Only the words the platforms themselves render belong here —
 * bios, captions and follower counts are account data and live in the preset.
 */

const STRINGS = {
  en: {
    'ig.posts': 'posts',
    'ig.followers': 'followers',
    'ig.following': 'following',

    follow: 'Follow',
    message: 'Message',

    'fb.posts': 'Posts',
    'fb.about': 'About',
    'fb.photos': 'Photos',
    'fb.more': 'More',
    'fb.like': 'Like',
    'fb.comment': 'Comment',
    'fb.share': 'Share',

    'tt.following': 'Following',
    'tt.followers': 'Followers',
    'tt.likes': 'Likes',
    'tt.pinned': 'Pinned',
  },

  et: {
    // Estonian takes the partitive after a numeral: "273 postitust".
    'ig.posts': 'postitust',
    'ig.followers': 'jälgijat',
    'ig.following': 'jälgitavat',

    follow: 'Jälgi',
    message: 'Sõnum',

    'fb.posts': 'Postitused',
    'fb.about': 'Teave',
    'fb.photos': 'Fotod',
    'fb.more': 'Veel',
    'fb.like': 'Meeldib',
    'fb.comment': 'Kommenteeri',
    'fb.share': 'Jaga',

    'tt.following': 'Jälgitavat',
    'tt.followers': 'Jälgijat',
    'tt.likes': 'Meeldimist',
    'tt.pinned': 'Kinnitatud',
  },
};

export const LANGUAGES = Object.keys(STRINGS);
export const DEFAULT_LANG = 'en';

/** Paint the chrome in `lang`, falling back to English for anything missing. */
export function applyLang(lang) {
  const table = STRINGS[lang] ?? STRINGS[DEFAULT_LANG];
  document.documentElement.dataset.uiLang = STRINGS[lang] ? lang : DEFAULT_LANG;

  for (const el of document.querySelectorAll('[data-ui]')) {
    const key = el.dataset.ui;
    const value = table[key] ?? STRINGS[DEFAULT_LANG][key];
    if (value !== undefined) el.textContent = value;
  }
}
