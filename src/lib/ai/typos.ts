// Phase 47 (TPLAI-02): curated typo set for the post-Gemini spelling gate.
// Case-insensitive callers MUST normalize via .toUpperCase() before lookup.
// Curated from common AI mis-spellings — extend opportunistically.
//
// Note: NEEDLES and CALENDER removed — both are real English words (sewing
// needles, acupuncture; cloth/paper pressing machine) that produce false
// positives on legitimate topics. The token-based scanner has no semantic
// context to distinguish them from their correct-spelling counterparts.
//
// Source: 47-CONTEXT.md Area 2 (28 entries).
export const KNOWN_TYPOS: Set<string> = new Set<string>([
  'MUSICAN',
  'CARROUSEL',
  'ENTREPRENUER',
  'RECIEVE',
  'SEPERATE',
  'OCCURENCE',
  'BUSSINESS',
  'ACCOMODATE',
  'DEFINATELY',
  'EXISTANCE',
  'MAINTENENCE',
  'OCCASIONALY',
  'PRIVILEDGE',
  'RHYTM',
  'SUPRISE',
  'TOMMOROW',
  'UNTILL',
  'WIERD',
  'AGGRESIVE',
  'CONSCIOUSE',
  'DISSAPPOINT',
  'EMBARASS',
  'GAURDIAN',
  'HARRASS',
  'INDEPENDANCE',
  'MILLENIUM',
  'PERSUE',
  'RELEVENT',
])
