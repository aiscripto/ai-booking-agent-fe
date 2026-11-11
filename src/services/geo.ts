// ── Countries and states for the Business form ──────────────────────────────
//
// A small, license-clean list kept in the app (no outside service, no big data file).
//  * Countries: the 249 ISO 3166-1 codes. The names come from the browser (Intl.DisplayNames), so they are
//    in the user's language and never typed by hand.
//  * States and provinces: only for the US, Canada and Australia, where a postal address needs one.
//    For every other country the state is a free text box. Cities are always free text.
// ────────────────────────────────────────────────────────────────────────────

const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

export interface Option {
  code: string;
  name: string;
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(undefined, { type: 'region' }) : null;

/** Every country, sorted by name. If the browser cannot give a name, the code itself is shown (nothing is invented). */
export function countries(): Option[] {
  return COUNTRY_CODES.map((code) => ({ code, name: regionNames?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
}

export function countryName(code: string): string {
  return regionNames?.of(code) ?? code;
}

const STATES: Record<string, Option[]> = {
  US: [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
    ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'],
    ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
    ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
    ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
    ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
    ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
    ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
    ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ].map(([code, name]) => ({ code, name })),
  CA: [
    ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'],
    ['NL', 'Newfoundland and Labrador'], ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'],
    ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon'],
  ].map(([code, name]) => ({ code, name })),
  AU: [
    ['ACT', 'Australian Capital Territory'], ['NSW', 'New South Wales'], ['NT', 'Northern Territory'],
    ['QLD', 'Queensland'], ['SA', 'South Australia'], ['TAS', 'Tasmania'], ['VIC', 'Victoria'], ['WA', 'Western Australia'],
  ].map(([code, name]) => ({ code, name })),
};

/** The states of a country, or an empty list when the app has none (then the state is typed by hand). */
export function statesOf(countryCode: string): Option[] {
  return STATES[countryCode] ?? [];
}

const ZIP: Record<string, { pattern: RegExp; example: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, example: '12345 or 12345-6789' },
  CA: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, example: 'K1A 0B1' },
  AU: { pattern: /^\d{4}$/, example: '2000' },
  GB: { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, example: 'SW1A 1AA' },
};

/** A message when the zip does not fit the country's format. Empty when it fits, or when the country has no rule. */
export function zipProblem(countryCode: string, zip: string): string {
  const rule = ZIP[countryCode];
  if (!rule || zip.trim() === '') return '';
  return rule.pattern.test(zip.trim()) ? '' : `Use the ${countryName(countryCode)} format, for example ${rule.example}.`;
}

export interface CoordinateProblems {
  latitude: string;
  longitude: string;
}

/**
 * Checks the two coordinate boxes. Both empty is fine (no pin). A number must be a real number in range, and
 * one box cannot be filled without the other. Nothing is ever cleared or rounded silently.
 */
export function coordinateProblems(latitude: string, longitude: string): CoordinateProblems {
  const check = (raw: string, min: number, max: number, label: string): string => {
    const text = raw.trim();
    if (text === '') return '';
    if (!/^-?\d+(\.\d+)?$/.test(text)) return `${label} must be a number like 30.2672 (use a dot, not a comma).`;
    const value = Number(text);
    return value < min || value > max ? `${label} must be between ${min} and ${max}.` : '';
  };
  const problems = { latitude: check(latitude, -90, 90, 'Latitude'), longitude: check(longitude, -180, 180, 'Longitude') };
  if (!problems.latitude && !problems.longitude) {
    const hasLat = latitude.trim() !== '';
    const hasLng = longitude.trim() !== '';
    if (hasLat && !hasLng) problems.longitude = 'Longitude is needed too, or clear the latitude.';
    if (hasLng && !hasLat) problems.latitude = 'Latitude is needed too, or clear the longitude.';
  }
  return problems;
}

/** A phone number needs at least 5 digits and only digits, spaces and + - ( ) . */
export function phoneProblem(phone: string): string {
  const text = phone.trim();
  if (text === '') return '';
  if (!/^[+()\d\s.-]+$/.test(text)) return 'Use digits, spaces and + - ( ) . only.';
  return text.replace(/\D/g, '').length < 5 ? 'A phone number needs at least 5 digits.' : '';
}

/** An email must look like name@domain.tld. */
export function emailProblem(email: string): string {
  const text = email.trim();
  if (text === '') return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) ? '' : 'Enter a valid email address, for example name@example.com.';
}
