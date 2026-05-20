import type { SlideTemplate } from './index'

// "News Oracle" — the Oracle-style news keeper added for the marketing-launch
// picker (quick task 260518-jhg).
//
// This template crystallizes the visual style DNA of the user's polished
// project "Oracle Layoff Analysis", which renders on `news-drop`'s base
// (Anton, near-black background) with heavy per-slide overrides. Rather than
// leave that proven look locked inside one project's overrides, this flat
// reusable `SlideTemplate` config captures it so the picker can lead with a
// proven, polished news style.
//
// Structural base: news-drop (the Oracle carousel actually renders on it) plus
// the news-cyan dark-overlay treatment (0.45 tint under the headline for
// legibility against bright news photography).
//
// THE differentiator vs news-cyan / news-drop: news-oracle is CENTER-aligned.
// The Oracle hooks are centered; news-cyan and news-drop are left-aligned.
//
// `backgroundMode` / `overlays` / `coverLayout` / `grainMode` / `vignette` /
// `photoTreatment` / `paletteMode` / `aiVoiceNote` are intentionally left
// undefined so the template keeps the newsZone full-bleed render path,
// mirroring news-drop / news-cyan, and so templates.test.ts stays happy
// (non-legacy ids that are NOT backgroundMode templates must have `overlays`
// undefined).
export const newsOracle: SlideTemplate = {
  id: 'news-oracle',
  name: 'News Oracle',
  thumbnail: '/templates/news-oracle.png',
  fontFamily: "'Anton', sans-serif",
  // Representative single hook size — project Oracle slides run 120-140px;
  // 130 sits between news-cyan (124) and the high end.
  hookFontSize: '130px',
  // Anton ships single-weight (400) on Google Fonts. Force 400 so Satori PNG
  // export matches browser preview (see SlideTemplate.hookFontWeight doc).
  hookFontWeight: 400,
  bodyFontSize: '38px',
  textColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  // Dark photo overlay for headline legibility — same model as news-cyan.
  overlayColor: '#0a0a0a',
  overlayOpacity: 0.45,
  // Center-aligned: the main visual differentiator vs news-cyan / news-drop.
  textAlign: 'center',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  // Cyan accent — the Oracle cover uses #24ddeb, the rest #00E5FF; #00E5FF is
  // the representative value (also matches news-cyan).
  accentColor: '#00E5FF',
  sample: {
    hook_text: 'ORACLE CUTS 30,000 JOBS IN MASSIVE SHAKEUP',
    body_text: '',
    hook_segments: [
      { text: 'ORACLE' },
      { text: 'CUTS' },
      { text: '30,000' },
      { text: 'JOBS' },
      { text: 'IN' },
      { text: 'MASSIVE', accent: true, highlightStyle: 'pill' },
      { text: 'SHAKEUP', accent: true, highlightStyle: 'pill' },
    ],
    layout: 'cover',
  },
  // quick-260519-cdf: tuned caption-card baseline for the Oracle look. taller
  // card (42%), softer top edge (15% edge-blend), and slightly more photo
  // visibility (opacity 0.80 vs the global 0.85). Applies to every slide using
  // news-oracle unless the user explicitly overrides the matching caption_bar_*
  // key on a per-slide basis.
  captionCardDefaults: {
    heightPct: 42,
    blendPct: 15,
    opacity: 0.80,
  },
}
