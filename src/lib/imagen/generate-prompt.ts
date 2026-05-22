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

Do NOT mention text, typography, or slide content. Focus purely on the visual aesthetic that will tie the slide visuals together.`,
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
      contents: `Generate a concise image prompt for a TikTok carousel slide visual.
Topic: "${topic}"
Hook text: "${hookText}"
Body text: "${bodyText}"
${isCta ? 'This is the closing CTA slide.' : ''}${styleContext}${userContext}

The image is a photographic scene that sits behind a text overlay.
Prefer a real adult human subject when the slide content suits it — a person reacting, gesturing, using an object, or candidly engaged with the topic. Fall back to an empty scene only when no human subject makes sense.
COMPOSITION: keep the subject off-center (lower third or to one side) and leave generous empty negative space in the upper-center area where the headline text will sit. The subject must not be centered or fill the frame.
${masterStyle ? 'IMPORTANT: Follow the master visual style above. Use the same color palette, art style, and mood. Vary the composition slightly for each slide but keep the overall look cohesive.' : ''}
Do NOT include any text, letters, or words in the image. Be specific about the subject, setting, lighting, and mood.
Keep the prompt under 100 words.`,
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
    return `Documentary-style photo with a candid adult subject, related to ${topic}, composed with empty negative space in the upper area for a text overlay${masterStyle ? `. Style: ${masterStyle}` : ''}`
  }
}
