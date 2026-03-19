import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { CarouselSchema, type Carousel } from './schemas'
import { buildSystemPrompt } from './prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateSlideContent(topic: string): Promise<Carousel> {
  const response = await client.messages.parse({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: `Create a TikTok carousel about: ${topic}` }],
    output_config: { format: zodOutputFormat(CarouselSchema) },
  })

  return response.parsed_output as Carousel
}
