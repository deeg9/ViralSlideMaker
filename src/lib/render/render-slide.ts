import type { SlideTemplate } from './templates'
import type { Slide } from '../types/slide'

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
  return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;900&display=swap" rel="stylesheet">`
}

export function buildSlideHtml(
  slide: Slide,
  template: SlideTemplate
): string {
  const backgroundCss = slide.background_url
    ? `background-image: url('${slide.background_url}'); background-size: cover; background-position: center;`
    : `background-color: ${template.backgroundColor};`

  const positionMap = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  }

  return `<!DOCTYPE html>
<html>
<head>
  <!-- Note: For server rendering with node-html-to-image, use waitUntil: 'networkidle0' to ensure font loading -->
  ${getFontLink(template.fontFamily)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1920px;
      ${backgroundCss}
      font-family: ${template.fontFamily};
      color: ${template.textColor};
      display: flex;
      flex-direction: column;
      justify-content: ${positionMap[template.textPosition]};
      align-items: ${template.textAlign === 'center' ? 'center' : template.textAlign === 'right' ? 'flex-end' : 'flex-start'};
      text-align: ${template.textAlign};
      padding: 80px 60px;
      position: relative;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background-color: ${template.overlayColor};
      opacity: ${template.overlayOpacity};
    }
    .content {
      position: relative;
      z-index: 1;
      max-width: 960px;
    }
    .hook {
      font-size: ${template.hookFontSize};
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 40px;
      ${template.hookStyle === 'uppercase' ? 'text-transform: uppercase;' : ''}
      ${template.hookStyle === 'italic' ? 'font-style: italic;' : ''}
    }
    .body {
      font-size: ${template.bodyFontSize};
      font-weight: 400;
      line-height: 1.5;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="overlay"></div>
  <div class="content">
    <div class="hook">${escapeHtml(slide.hook_text)}</div>
    <div class="body">${escapeHtml(slide.body_text)}</div>
  </div>
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
