import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'
import { resolveSlideStyles } from './resolve-styles'

/**
 * Build a Google Fonts <link> tag for the given font-family CSS value.
 * Extracts the font name from a CSS font-family string like "'Montserrat', sans-serif"
 * and returns the appropriate Google Fonts link with weights 400, 700, 900.
 */
export function getFontLink(fontFamily: string): string {
  // Extract font name from CSS font-family (content inside single quotes, or first word)
  const match = fontFamily.match(/'([^']+)'/)
  const fontName = match ? match[1] : 'Inter'
  const encoded = fontName.replace(/\s+/g, '+')
  return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap" rel="stylesheet">`
}

export function buildSlideHtml(
  slide: Slide,
  template: SlideTemplate
): string {
  const styles = resolveSlideStyles(slide, template)

  const backgroundCss = slide.background_url
    ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
    : `background-color: ${template.backgroundColor};`

  // Generate font links for all fonts used
  const hookFontLink = getFontLink(styles.hookFontFamily)
  const bodyFontLink = styles.bodyFontFamily !== styles.hookFontFamily
    ? getFontLink(styles.bodyFontFamily)
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <!-- Note: For server rendering with node-html-to-image, use waitUntil: 'networkidle0' to ensure font loading -->
  ${hookFontLink}
  ${bodyFontLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1920px;
      ${backgroundCss}
      font-family: ${template.fontFamily};
      color: ${styles.textColor};
      position: relative;
      overflow: hidden;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background-color: ${template.overlayColor};
      opacity: ${styles.overlayOpacity};
    }
    .hook {
      position: absolute;
      left: ${styles.hookX}%;
      top: ${styles.hookY}%;
      width: ${styles.hookWidth}%;
      text-align: ${styles.textAlign};
      z-index: 1;
      font-family: ${styles.hookFontFamily};
      font-size: ${styles.hookFontSize}px;
      font-weight: ${styles.hookFontWeight};
      line-height: 1.1;
      ${styles.hookTextTransform === 'uppercase' ? 'text-transform: uppercase;' : ''}
      font-style: ${styles.hookFontStyle};
    }
    .body {
      position: absolute;
      left: ${styles.bodyX}%;
      top: ${styles.bodyY}%;
      width: ${styles.bodyWidth}%;
      text-align: ${styles.textAlign};
      z-index: 1;
      font-family: ${styles.bodyFontFamily};
      font-size: ${styles.bodyFontSize}px;
      font-weight: ${styles.bodyFontWeight};
      font-style: ${styles.bodyFontStyle};
      line-height: 1.5;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="overlay"></div>
  <div class="hook">${escapeHtml(slide.hook_text)}</div>
  <div class="body">${escapeHtml(slide.body_text)}</div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
