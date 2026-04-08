import { ApiReference } from '@scalar/nextjs-api-reference'
import { openApiSpec } from '@/lib/api/openapi'

export const GET = ApiReference({
  content: openApiSpec,
  metaData: {
    title: 'ViralSlideMaker API Reference',
  },
})
