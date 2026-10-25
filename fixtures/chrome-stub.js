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
window.posted = [];
window.chrome = {
  storage: {
    local: {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, store[k]])),
      set: async (values) => Object.assign(store, values),
    },
  },
  tabs: { query: async () => [{ id: 1, url: "https://job-boards.example.test/apply" }] },
  scripting: {
    executeScript: async ({ func }) =>
      !func ? [] : String(func).includes("__folioCapture") ? [{ result: CAPTURED }] : [{ result: { report: [] } }],
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
      fields: { firstName: "Testy", lastName: "McTestface", email: "t@example.test", workAuthorized: "Yes", gender: "Female" },
    },
    answers: window.posted,
  });
};
window.previewStore = store;
