// Turns the saved notice period into what a start-date question needs, worked
// out on the day the user clicks Fill: notice weeks are added to today and moved
// to the next Monday ("2 weeks" on Sun Oct 25 → Mon Nov 9).

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nextMonday = (d) => addDays(d, (8 - d.getDay()) % 7);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const long = (d) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function startPlan(fields, now = new Date()) {
  const notice = fields?.noticePeriod;
  if (!notice) return null;
  const today = startOfDay(now);
  let date, weeks, text;
  if (notice === "Immediately") {
    date = today;
    weeks = 0;
    text = "Immediately";
  } else if (notice === "Specific date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fields.availableFrom || "");
    if (!m) return null;
    const saved = new Date(+m[1], +m[2] - 1, +m[3]);
    // A date that has passed means "available now", not a start in the past.
    date = saved < today ? today : saved;
    weeks = Math.ceil((date - today) / (7 * DAY));
    text =
      date.getTime() === today.getTime()
        ? "Immediately"
        : `Available from ${long(date)}`;
  } else {
    const n = parseInt(notice, 10);
    if (!(n > 0)) return null;
    date = nextMonday(addDays(today, 7 * n));
    weeks = n;
    text = `${n} week${n === 1 ? "'s" : "s'"} notice (available ${long(date)})`;
  }
  return { notice, weeks, date, iso: iso(date), text };
}

// Text boxes that spell out a date format get a bare date in that format.
export function dateForTextField(plan, hint) {
  const h = String(hint || "").toLowerCase();
  const d = plan.date;
  const [y, mo, da] = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ];
  if (/yyyy-mm-dd/.test(h)) return `${y}-${mo}-${da}`;
  if (/dd\/mm\/yyyy/.test(h)) return `${da}/${mo}/${y}`;
  if (/mm\/dd\/yyyy|mm\/dd\/yy/.test(h)) return `${mo}/${da}/${y}`;
  return null;
}

// --- choosing among options like "Immediately / 2 weeks / 1 month" ----------
const NUMBER = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  eight: 8,
  twelve: 12,
};
const num = (s) => NUMBER[s] ?? Number(s);
const UNIT = (u) =>
  u.startsWith("month") ? 4 : u.startsWith("day") ? 1 / 7 : 1;
const N = "(\\d+|a|an|one|two|three|four|five|six|eight|twelve)";
const U = "(days?|weeks?|months?)";
const EPS = 0.001;

// Returns the range of notice weeks an option means, or null if it is not one.
export function optionWeeks(text) {
  const t = String(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\b(immediate(ly)?|asap|as soon as possible|right away|no notice)\b/.test(t)
  )
    return [0, 0];
  let m = new RegExp(`\\b${N} ?(?:-|to|–) ?${N} ?${U}`).exec(t);
  if (m) return [num(m[1]) * UNIT(m[3]), num(m[2]) * UNIT(m[3])];
  // "less than 2 weeks" excludes 2; "within 2 weeks" includes it.
  m = new RegExp(
    `\\b(less than|under|within|up to|no more than) ${N} ?${U}`,
  ).exec(t);
  if (m)
    return [0, num(m[2]) * UNIT(m[3]) - (/less|under/.test(m[1]) ? EPS : 0)];
  m = new RegExp(`\\b(more than|over|at least) ${N} ?${U}`).exec(t);
  if (m)
    return [num(m[2]) * UNIT(m[3]) + (m[1] === "at least" ? 0 : EPS), Infinity];
  m = new RegExp(`\\b${N} ?\\+ ?${U}`).exec(t);
  if (m) return [num(m[1]) * UNIT(m[2]), Infinity];
  m = new RegExp(`\\b${N} ?${U}`).exec(t);
  if (m) return [num(m[1]) * UNIT(m[2]), num(m[1]) * UNIT(m[2])];
  return null;
}

export function matchNotice(options, plan) {
  const fits = options
    .map((o, i) => ({ i, r: optionWeeks(o) }))
    .filter(({ r }) => r && r[0] <= plan.weeks && plan.weeks <= r[1]);
  if (!fits.length) return -1;
  const width = ({ r }) => r[1] - r[0];
  fits.sort((a, b) => width(a) - width(b));
  // Two equally specific options ("within 2 weeks" vs "2-4 weeks"): ask the user.
  return fits.length > 1 && width(fits[0]) === width(fits[1]) ? -1 : fits[0].i;
}
