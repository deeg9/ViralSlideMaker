// Phase 47 (TPLAI-02): curated typo set for the post-Gemini spelling gate.
// Case-insensitive callers MUST normalize via .toUpperCase() before lookup.
// Curated from common AI mis-spellings — extend opportunistically.
//
// Source: 47-CONTEXT.md Area 2.
export const KNOWN_TYPOS: Set<string> = new Set<string>([
  'MUSICAN',
  'CARROUSEL',
  'ENTREPRENUER',
  'RECIEVE',
  'SEPERATE',
  'OCCURENCE',
  'NEEDLES',
  'BUSSINESS',
  'ACCOMODATE',
  'CALENDER',
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
