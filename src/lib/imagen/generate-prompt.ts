import { GoogleGenAI, Type } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function generateImagePrompt(
  topic: string,
  hookText: string,
  bodyText: string,
  isCta: boolean,
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a concise image prompt for a TikTok carousel slide background.
Topic: "${topic}"
Hook text: "${hookText}"
Body text: "${bodyText}"
${isCta ? 'This is the closing CTA slide.' : ''}

The image should be a mood/aesthetic background photo that complements the text overlay.
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
    return `Professional aesthetic background for ${topic}`
  }
}
