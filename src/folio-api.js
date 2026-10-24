// Talks to the local Folio server. The pairing key is only ever sent to a
// loopback address the user configured.
export const DEFAULT_URL = "http://127.0.0.1:5173";

export async function loadSettings() {
  const {
    folioUrl = DEFAULT_URL,
    pairingKey = "",
    resumeId = "",
  } = await chrome.storage.local.get(["folioUrl", "pairingKey", "resumeId"]);
  return { folioUrl, pairingKey, resumeId };
}
export const saveSettings = (values) => chrome.storage.local.set(values);

export function checkUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter Folio's address, for example http://127.0.0.1:5173");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error(
      "Folio runs on this computer only: use http://127.0.0.1:<port>.",
    );
  return url.origin;
}

async function call(settings, route) {
  let response;
  try {
    response = await fetch(settings.folioUrl + route, {
      headers: { "X-Folio-Extension-Key": settings.pairingKey },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `Folio is not running at ${settings.folioUrl}. Start it with npm run dev.`,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Folio answered ${response.status}.`);
  }
  return response;
}

export async function fetchApplicant(settings) {
  const query = settings.resumeId
    ? "?resume=" + encodeURIComponent(settings.resumeId)
    : "";
  return (await call(settings, "/api/ext/applicant" + query)).json();
}

export async function fetchResumeFile(settings, resume) {
  if (!resume?.original) return null;
  const response = await call(
    settings,
    "/api/ext/resume-file?resume=" + encodeURIComponent(resume.id),
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const name = resume.original.filename;
  const extension = name.split(".").pop().toLowerCase();
  const type =
    {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    }[extension] || "application/octet-stream";
  return { name, type, base64: btoa(binary) };
}
