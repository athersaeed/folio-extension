// Groups per-frame fill reports for the popup: what was filled, what still needs
// the user (required and empty, or a fill that did not stick), and the rest.
// Fields the user switched off are never "attention", even when required.
export function summarize(frames) {
  const entries = frames.flatMap((f) => f.report || []);
  const filled = entries.filter((e) => e.status === "filled");
  const attention = entries.filter(
    (e) =>
      e.status === "failed" ||
      e.status === "check" ||
      (e.required && ["unmatched", "no-value"].includes(e.status)),
  );
  const skipped = entries.filter(
    (e) => !filled.includes(e) && !attention.includes(e),
  );
  return { filled, attention, skipped };
}
