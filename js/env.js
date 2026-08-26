/* Where is this copy running?
 *
 * Several things are loaded from files that are gitignored and therefore never
 * published: presets/local.json, and the logos and device frame in assets/.
 * Probing for them on a deployed site is harmless but hands every visitor a
 * handful of 404s in the console, which is untidy on a public page.
 *
 * So they are only looked for when the site is being served locally, which is
 * where those files can exist. A fork that commits its own assets and wants them
 * on its deployment should drop them from .gitignore and make this return true.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];

export function isLocal() {
  return LOCAL_HOSTS.includes(location.hostname);
}
