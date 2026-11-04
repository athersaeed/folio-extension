// Preview-only stand-in for the chrome.* APIs and the Folio server, so the real
// popup can be rendered in a normal tab. Synthetic data only.
const store = { folioUrl: "http://127.0.0.1:5173", pairingKey: "0".repeat(48) };
const CAPTURED = {
  company: "Synthetic Co",
  answers: [
    { question: "Are you at least 18 years of age?", answer: "Yes", kind: "choice", company: "" },
    { question: "Have you previously applied to this company?", answer: "No", kind: "choice", company: "Synthetic Co" },
    { question: "Why do you want to work here?", answer: "I like building tools that save people from repetitive work, and this team does exactly that.", kind: "draft", company: "Synthetic Co" },
  ],
};
// A long fill report, so the results list can be checked at full height.
const REPORT = [
  ...["First name", "Last name", "Email", "Phone", "LinkedIn", "Country", "City", "Postal code", "Gender", "Race", "Veteran status", "Disability status"].map((label) => ({ label, status: "filled" })),
  { label: "Are you legally authorized to work in this country?", status: "check", required: true },
  { label: "What is your preferred office location?", status: "unmatched", required: true },
  { label: "Desired salary", status: "no-value", required: true },
  { label: "Cover letter", status: "unmatched" },
  { label: "Twitter", status: "unmatched" },
];
window.posted = [];
window.chrome = {
  storage: {
    local: {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, store[k]])),
      set: async (values) => Object.assign(store, values),
    },
  },
  // ?tab=<url> previews the popup as if that page were the active tab.
  tabs: {
    query: async () => [
      { id: 1, url: new URLSearchParams(location.search).get("tab") || "https://job-boards.example.test/apply" },
    ],
  },
  scripting: {
    executeScript: async ({ func }) =>
      !func ? [] : String(func).includes("__folioCapture") ? [{ result: CAPTURED }] : [{ result: { report: REPORT } }],
  },
};
const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
window.fetch = async (url, init = {}) => {
  if (String(url).endsWith("/api/ext/answers")) {
    const { answers } = JSON.parse(init.body);
    window.posted.push(...answers);
    return json({ added: answers.length, updated: 0, total: window.posted.length });
  }
  return json({
    resumes: [{ id: "r1", name: "Synthetic resume", original: { filename: "cv.pdf", size: 1 } }],
    applicant: {
      resume: { id: "r1", name: "Synthetic resume", original: { filename: "cv.pdf", size: 1 } },
      fields: { firstName: "Testy", lastName: "McTestface", email: "t@example.test", phone: "+1 555 0100", linkedin: "https://linkedin.example.test/in/testy", city: "Springfield", country: "Canada", workAuthorized: "Yes", gender: "Female", noticePeriod: "2 weeks" },
      experience: [{ company: "Example Corp", title: "Software Developer", location: "Springfield", startDate: "May 2023", endDate: "Present", description: "Built internal tools.\nCut report time by half." }],
      education: [{ school: "Example University", degree: "BSc", fieldOfStudy: "Computer Science", startDate: "2019", endDate: "2023" }],
      skills: "JavaScript, Python, SQL",
    },
    answers: window.posted,
  });
};
window.previewStore = store;
