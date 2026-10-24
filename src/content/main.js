// Injected into the page (and same-tab frames) only when the user clicks Fill.
import { autofill } from "./autofill.js";

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

globalThis.__folioAutofill = async (applicant, file) => ({
  url: location.href,
  isTop: window === window.top,
  report: await autofill(
    document,
    applicant,
    file && { name: file.name, type: file.type, bytes: decode(file.base64) },
  ),
});
