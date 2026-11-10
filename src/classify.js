// Maps a form field's visible label (plus id/name/autocomplete hints) to a Folio
// profile key. Rules are ordered: the first rule whose pattern matches and whose
// guard does not wins. Returning null is always safer than a wrong guess.

export function normalize(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_\-*✱:?()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Labels about someone other than the applicant.
const OTHER_PERSON =
  /\b(reference|referr(er|al)|emergency|manager|supervisor|recruiter|parent|spouse|contact person|company|employer|school|university|college|institution|hiring)\b/;

// Follow-up boxes that explain an earlier answer ("If yes, please list the
// type of sponsorship you need") rather than ask the question itself.
const FOLLOW_UP =
  /^if\b|\b(please )?(list|describe|explain|specify|elaborate)\b|\bwhat (type|kind|sponsorship)\b|\b(what|which) countries\b|\btell us\b/;

// Opt-ins that mention a contact channel ("receive updates by email or SMS?").
const OPT_IN =
  /\b(would you like|receive|opt (in|out)|subscribe|newsletter|alerts?|updates|email me)\b/;

// One question about two things ("based within 50 miles, or able to relocate
// before your start date?"); none of its parts is the whole answer.
const COMPOUND = /\bcommut|\bwithin \d+ (miles|km)\b/;

const AUTOCOMPLETE = {
  "given-name": "firstName",
  "family-name": "lastName",
  name: "name",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  country: "country",
  "country-name": "country",
  "street-address": "addressLine1",
  "address-line1": "addressLine1",
  "address-line2": "addressLine2",
  "address-level2": "city",
  "address-level1": "region",
  "postal-code": "postalCode",
  url: "website",
};

const RULES = [
  {
    key: "preferredName",
    re: /\b(preferred|chosen) (first |full )?name\b|\bnick ?name\b|\bname (you|you'd|you would|would you) prefer\b/,
    // "Share your preferred name and pronouns" is one box for both.
    guard: /\bpronouns?\b/,
  },
  {
    key: "firstName",
    re: /\b(first|given|fore) ?name\b|^first$/,
    guard: OTHER_PERSON,
  },
  {
    key: "lastName",
    re: /\b(last|family|sur) ?name\b|^last$/,
    guard: OTHER_PERSON,
  },
  {
    key: "name",
    re: /^(your |legal |full |candidate |applicant )?(full )?name$|\bfull (legal )?name\b|\blegal name\b/,
    guard: OTHER_PERSON,
  },
  { key: "pronouns", re: /\bpronouns?\b/, guard: /\bname and pronouns\b/ },
  {
    key: "email",
    re: /\be ?mail\b/,
    guard: new RegExp(`${OTHER_PERSON.source}|${OPT_IN.source}`),
  },
  {
    key: "phone",
    re: /\b(phone|mobile|telephone|cell)( number)?\b/,
    guard: new RegExp(
      `\\b(type|extension|ext)\\b|emergency|reference|${OPT_IN.source}`,
    ),
  },
  { key: "linkedin", re: /\blinked ?in\b/ },
  { key: "github", re: /\bgit ?hub\b/ },
  {
    key: "website",
    re: /\b(personal )?(website|portfolio|blog|home ?page)\b|\bpersonal (site|url)\b|^(other )?url$/,
    guard: /linked ?in|git ?hub|company|employer/,
  },
  // Eligibility before location so "authorized to work in the country" stays here.
  {
    key: "requiresSponsorship",
    re: /\bsponsor(ship)?\b|\bvisa\b.*\b(need|require)|\b(need|require)\b.*\bvisa\b/,
    guard: FOLLOW_UP,
  },
  {
    key: "workAuthorized",
    re: /\b(legally )?(authori[sz]ed|eligible|permitted|entitled)\b.*\bwork\b|\bright to work\b|\bwork (authori[sz]ation|permit)\b/,
    guard: FOLLOW_UP,
  },
  {
    key: "willingToRelocate",
    re: /\breloca/,
    guard: new RegExp(`${FOLLOW_UP.source}|${COMPOUND.source}|\\bplans?\\b`),
  },
  {
    key: "salaryExpectation",
    re: /\bsalary\b|\b(desired|expected) (pay|compensation)\b|\bcompensation expectations?\b/,
  },
  {
    key: "startDate",
    re: /\bstart date\b|\bwhen can you start\b|\bnotice period\b|\bearliest (possible )?(start|availability)\b|\bearliest\b.*\bstart\b|\bavailable to start\b/,
    guard: new RegExp(`\\b(month|year)$|${COMPOUND.source}`),
  },
  {
    key: "howHeard",
    re: /\bhow did (you|your) (\w+ )?(hear|find out|learn|find|come across)\b|\bwhere (did|have) you (\w+ )?(hear|heard|find|found|see|seen|learn|learned)\b|\breferral source\b/,
  },
  {
    key: "country",
    re: /^country( of residence)?$|\bcountry of residence\b|\b(which|the) country\b.*\b(live|reside|based|located)\b|\bcountry (do|where) you (currently )?(live|reside)\b|\bcountry are you (currently )?(based|located|living)\b|\b(based|located|live|reside) in (any of )?(these|the following) countries\b/,
  },
  // Mailing address parts, before location so a bare "City" box gets just the city.
  {
    key: "addressLine2",
    re: /\baddress (line )?2\b|^(apt|apartment|suite|unit)\b/,
    guard: OTHER_PERSON,
  },
  {
    key: "addressLine1",
    re: /\baddress (line )?1\b|^(street |mailing |home |residential )?address$|\bstreet address\b/,
    guard: OTHER_PERSON,
  },
  { key: "city", re: /^(city|town|city town|town city)$/ },
  {
    key: "region",
    re: /^(state|province|region|territory)( ?(\/|or) ?(state|province|region|territory))*( of residence)?$|\b(state|province)\b.*\b(reside|live|located|based)\b|\b(state|province) of residence\b/,
    guard:
      /\b(city|country|address)\b|^(please )?state (your|the|why|how|what|where|which)\b/,
  },
  {
    key: "postalCode",
    re: /\b(postal|zip|post) ?code\b|^zip$|^postcode$|\bpostcode\b/,
    guard: OTHER_PERSON,
  },
  {
    key: "location",
    re: /^(current )?location$|^current city$|\bcurrent (location|city)\b|\bwhere are you (currently )?(based|located|living)\b|\bcity,? (and )?state\b|^location city$|\bwhere do you (currently )?(live|reside)\b/,
    guard: /prefer|relocat|office|willing/,
  },
  // Voluntary self-identification.
  { key: "hispanicLatino", re: /\bhispanic\b|\blatin[oax]\b/ },
  {
    key: "race",
    re: /\brace\b|\bethnicit(y|ies)\b|\bracial\b|\bethnic (background|identity|origin)\b/,
  },
  {
    key: "gender",
    re: /\bgender\b|\bsex\b/,
    guard: /\btransgender\b|\bidentity\b.*\bdiffer/,
  },
  {
    key: "veteranStatus",
    re: /\bveteran\b|\bmilitary (status|service)\b|\bserved in the (military|armed forces)\b/,
  },
  { key: "disabilityStatus", re: /\bdisabilit(y|ies)\b/ },
];

export function classify({
  label = "",
  id = "",
  name = "",
  autocomplete = "",
  kind = "text",
} = {}) {
  if (kind === "file") {
    const text = normalize(`${label} ${id} ${name}`);
    if (/\bcover\b/.test(text)) return null;
    return /\b(resume|cv|curriculum)\b/.test(text) ? "resume" : null;
  }
  const auto = AUTOCOMPLETE[String(autocomplete).toLowerCase().trim()];
  if (auto) return auto;
  for (const text of [normalize(label), normalize(`${id} ${name}`)]) {
    if (!text) continue;
    for (const rule of RULES)
      if (rule.re.test(text) && !(rule.guard && rule.guard.test(text)))
        return rule.key;
  }
  return null;
}
