// Preview-only stand-in for the chrome.* APIs and the Folio server, so the real
// popup can be rendered in a normal tab. Synthetic data only.
const store = { folioUrl: "http://127.0.0.1:5173", pairingKey: "0".repeat(48) };
window.chrome = {
  storage: {
    local: {
      get: async (keys) =>
        Object.fromEntries(
          []
            .concat(keys)
            .filter((k) => k in store)
            .map((k) => [k, store[k]]),
        ),
      set: async (values) => Object.assign(store, values),
    },
  },
  tabs: { query: async () => [] },
};
window.fetch = async () =>
  new Response(
    JSON.stringify({
      resumes: [
        {
          id: "r1",
          name: "Synthetic resume",
          original: { filename: "cv.pdf", size: 1 },
        },
      ],
      applicant: {
        resume: {
          id: "r1",
          name: "Synthetic resume",
          original: { filename: "cv.pdf", size: 1 },
        },
        fields: {
          firstName: "Testy",
          lastName: "McTestface",
          email: "t@example.test",
          workAuthorized: "Yes",
          gender: "Female",
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
window.previewStore = store;
