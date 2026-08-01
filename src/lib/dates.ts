// Deterministic date formatting. Without a fixed locale the server and the
// browser can disagree (for example 30/07/2026 vs 7/30/2026), which makes
// React discard and re-render the tree on hydration.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(value: Date | string) {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return DATE_TIME.format(new Date(value));
}
