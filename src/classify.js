// Maps a form field's visible label (plus id/name/autocomplete hints) to a Folio
// profile key. Rules are ordered: the first rule whose pattern matches and whose
// guard does not wins. Returning null is always safer than a wrong guess.

export function normalize(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_\-*:?()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Labels about someone other than the applicant.
const OTHER_PERSON =
  /\b(reference|referr(er|al)|emergency|manager|supervisor|recruiter|parent|spouse|contact person|company|employer|school|university|college|institution|hiring)\b/;

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
    re: /\b(preferred|chosen) (first )?name\b|\bnick ?name\b/,
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
  { key: "pronouns", re: /\bpronouns?\b/ },
  { key: "email", re: /\be ?mail\b/, guard: OTHER_PERSON },
  {
    key: "phone",
    re: /\b(phone|mobile|telephone|cell)( number)?\b/,
    guard: /\b(type|extension|ext)\b|emergency|reference/,
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
  },
  {
    key: "workAuthorized",
    re: /\b(legally )?(authori[sz]ed|eligible|permitted|entitled)\b.*\bwork\b|\bright to work\b|\bwork (authori[sz]ation|permit)\b/,
  },
  { key: "willingToRelocate", re: /\breloca/ },
  {
    key: "salaryExpectation",
    re: /\bsalary\b|\b(desired|expected) (pay|compensation)\b|\bcompensation expectations?\b/,
  },
  {
    key: "startDate",
    re: /\bstart date\b|\bwhen can you start\b|\bnotice period\b|\bearliest (possible )?(start|availability)\b|\bavailable to start\b/,
    guard: /\b(month|year)$/,
  },
  {
    key: "howHeard",
    re: /\bhow did you (\w+ )?(hear|find out|learn|find|come across)\b|\bwhere did you (\w+ )?(hear|find|see)\b|\breferral source\b/,
  },
  {
    key: "country",
    re: /^country( of residence)?$|\bcountry of residence\b|\b(which|the) country\b.*\b(live|reside|based|located)\b|\bcountry (do|where) you (currently )?(live|reside)\b/,
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
    re: /^(state|province|region|territory)( ?\/ ?(state|province|region|territory))*( of residence)?$|^state or province$|^province or state$|\b(state|province)\b.*\b(reside|live|located|based)\b|\b(state|province) of residence\b/,
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
    re: /^(current )?location$|^current city$|\bcurrent (location|city)\b|\bwhere are you (currently )?(based|located|living)\b|\bcity,? state\b|^location city$/,
    guard: /prefer|relocat|office|willing/,
  },
  // Voluntary self-identification.
  { key: "hispanicLatino", re: /\bhispanic\b|\blatin[oax]\b/ },
  {
    key: "race",
    re: /\brace\b|\bethnicity\b|\bracial\b|\bethnic (background|identity|origin)\b/,
  },
  {
    key: "gender",
    re: /\bgender\b|^sex$/,
    guard: /\btransgender\b|\bidentity\b.*\bdiffer/,
  },
  { key: "veteranStatus", re: /\bveteran\b/ },
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
