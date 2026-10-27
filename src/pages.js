// Is this tab Folio itself? localhost, 127.0.0.1 and [::1] on the same port are
// the same server, so the popup should not offer to fill or read Folio's own forms.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isFolioPage(tabUrl, folioUrl) {
  let tab, folio;
  try {
    tab = new URL(tabUrl);
    folio = new URL(folioUrl);
  } catch {
    return false;
  }
  const host = (u) => (LOOPBACK.has(u.hostname) ? "loopback" : u.hostname);
  return (
    tab.protocol === folio.protocol &&
    tab.port === folio.port &&
    host(tab) === host(folio)
  );
}
