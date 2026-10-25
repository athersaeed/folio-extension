// Firefox exposes promise-based APIs as `browser.*`; Chrome as `chrome.*`.
export const ext = globalThis.browser ?? globalThis.chrome;

// Host access the extension needs: Folio on this computer, and Greenhouse frames
// embedded in company career sites. Firefox lets users withhold these, so the
// popup asks again from a click (permissions.request needs a user gesture and
// resolves at once without a prompt when access is already granted).
export const HOSTS = [
  "http://127.0.0.1/*",
  "http://localhost/*",
  "https://*.greenhouse.io/*",
];
export const requestHosts = () =>
  ext.permissions?.request
    ? ext.permissions.request({ origins: HOSTS }).catch(() => false)
    : Promise.resolve(true);
