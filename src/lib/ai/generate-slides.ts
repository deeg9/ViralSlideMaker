import { GoogleGenAI, Type, type Schema } from '@google/genai'
import { CarouselSchema, type Carousel } from './schemas'
import { buildSystemPrompt } from './prompts'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Carousel title/topic' },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hook_text: { type: Type.STRING, description: 'Attention-grabbing hook for this slide' },
          body_text: { type: Type.STRING, description: 'Supporting body copy' },
          image_query: { type: Type.STRING, description: 'Pexels search query for background image' },
          is_cta: { type: Type.BOOLEAN, description: 'Whether this is the closing CTA slide' },
        },
        required: ['hook_text', 'body_text', 'image_query', 'is_cta'],
      },
    },
  },
  required: ['title', 'slides'],
}

export async function generateSlideContent(topic: string, slideCount: number = 7, imageStyleHint?: string): Promise<Carousel> {
  const imageHintText = imageStyleHint
    ? `\n\nWhen generating image_query values, incorporate this visual preference: "${imageStyleHint}"`
    : ''
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a TikTok carousel about: ${topic}\n\nGenerate exactly ${slideCount} slides (including the opening hook and closing CTA).${imageHintText}`,
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: 'application/json',
      responseSchema,
    },
  })

  const data = JSON.parse(response.text!)

  // Validate with Zod
  return CarouselSchema.parse(data)
}
