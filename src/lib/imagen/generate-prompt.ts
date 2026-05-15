import { GoogleGenAI, Type } from '@google/genai'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Generate a master visual style for an entire carousel.
 * This style string is prepended to every slide's Imagen prompt
 * so all slides share the same aesthetic (color palette, mood, art style).
 */
export async function generateCarouselStyle(topic: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `You are designing a cohesive visual style for a TikTok carousel about: "${topic}"

Generate a SHORT visual style guide (2-3 sentences max) that will be prepended to every slide's image prompt to ensure visual consistency across all slides.

Include:
- A specific color palette (e.g. "deep navy blues with warm amber accents")
- An art style or photographic approach (e.g. "soft-focus photography", "flat illustration", "3D render")
- A mood/atmosphere (e.g. "warm and inviting", "sleek and futuristic")

Do NOT mention text, typography, or slide content. Focus purely on the visual aesthetic that will tie the backgrounds together.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            style: { type: Type.STRING, description: 'Visual style guide for carousel consistency' },
          },
          required: ['style'],
        },
      },
    })

    const parsed = JSON.parse(response.text!)
    return parsed.style
  } catch {
    return `Cohesive professional aesthetic with consistent color palette for ${topic}`
  }
}

/**
 * Generate an Imagen prompt for a single slide, incorporating the carousel's master style.
 */
export async function generateImagePrompt(
  topic: string,
  hookText: string,
  bodyText: string,
  isCta: boolean,
  masterStyle?: string,
  userImagePrompt?: string,
): Promise<string> {
  try {
    const styleContext = masterStyle
      ? `\nMASTER VISUAL STYLE (all slides must follow this): "${masterStyle}"`
      : ''
    const userContext = userImagePrompt
      ? `\nUser's visual preference: "${userImagePrompt}"`
      : ''

    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Generate a concise image prompt for a TikTok carousel slide background.
Topic: "${topic}"
Hook text: "${hookText}"
Body text: "${bodyText}"
${isCta ? 'This is the closing CTA slide.' : ''}${styleContext}${userContext}

The image should be a mood/aesthetic background that complements the text overlay.
${masterStyle ? 'IMPORTANT: Follow the master visual style above. Use the same color palette, art style, and mood. Vary the composition slightly for each slide but keep the overall look cohesive.' : ''}
Do NOT include text in the image. Focus on atmosphere, colors, and visual mood.
Keep the prompt under 100 words. Be specific and descriptive.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'Imagen prompt for slide background' },
          },
          required: ['prompt'],
        },
      },
    })

    const parsed = JSON.parse(response.text!)
    return parsed.prompt
  } catch {
    return `Professional aesthetic background for ${topic}${masterStyle ? `. Style: ${masterStyle}` : ''}`
  }
}
