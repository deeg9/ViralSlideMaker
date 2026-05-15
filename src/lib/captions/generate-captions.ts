import { GoogleGenAI, Type } from '@google/genai'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'
import type { Slide } from '@/lib/types/slide'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export type CaptionResult =
  | { tiktok: string; instagram: string; linkedin: string }
  | { error: string }

export async function generateCaptions(
  slides: Slide[],
  topic: string,
): Promise<CaptionResult> {
  if (slides.length === 0) {
    return { error: 'No slides to generate captions for' }
  }

  try {
    const slidesSummary = slides
      .map(
        (s, i) =>
          `Slide ${i + 1}: Hook: "${s.hook_text}" Body: "${s.body_text}"`,
      )
      .join('\n')

    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Generate social media captions for a carousel about "${topic}".
The carousel has ${slides.length} slides with this content:
${slidesSummary}

For each platform, reference specific points from the slides (not just the topic).
TikTok: Short, punchy, 2-3 sentences + 5-8 hashtags. Under 2200 chars.
Instagram: Engaging, can be longer, 3-5 sentences + 20-30 hashtags. Line breaks for readability.
LinkedIn: Professional, thought-leadership tone. 2-3 paragraphs. 3-5 hashtags.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tiktok: {
              type: Type.STRING,
              description: 'TikTok caption with hashtags',
            },
            instagram: {
              type: Type.STRING,
              description: 'Instagram caption with hashtags and line breaks',
            },
            linkedin: {
              type: Type.STRING,
              description: 'LinkedIn post, professional tone',
            },
          },
          required: ['tiktok', 'instagram', 'linkedin'],
        },
      },
    })

    const parsed = JSON.parse(response.text!)
    return {
      tiktok: parsed.tiktok,
      instagram: parsed.instagram,
      linkedin: parsed.linkedin,
    }
  } catch {
    return { error: 'Caption generation failed' }
  }
}
