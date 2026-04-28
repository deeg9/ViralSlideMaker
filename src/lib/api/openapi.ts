/**
 * OpenAPI 3.1 specification for ViralSlideMaker REST API.
 *
 * Hand-written to stay simple and accurate. When a route's Zod schema
 * changes, update the corresponding schema here manually.
 */

const bearerAuth = {
  type: 'http' as const,
  scheme: 'bearer',
  description: 'API key (starts with vsl_). Pass as: Authorization: Bearer vsl_...',
}

const errorResponse = {
  type: 'object' as const,
  required: ['error'],
  properties: {
    error: {
      type: 'object' as const,
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string' as const,
          enum: [
            'UNAUTHORIZED',
            'RATE_LIMITED',
            'VALIDATION_ERROR',
            'INTERNAL_ERROR',
            'INSUFFICIENT_CREDITS',
            'NOT_FOUND',
            'FORBIDDEN',
          ],
        },
        message: { type: 'string' as const },
      },
    },
  },
}

const rateLimitHeaders = {
  'X-RateLimit-Limit': {
    schema: { type: 'integer' as const },
    description: 'Request limit per window',
  },
  'X-RateLimit-Remaining': {
    schema: { type: 'integer' as const },
    description: 'Remaining requests in current window',
  },
  'x-credits-remaining': {
    schema: { type: 'integer' as const },
    description: 'Credit balance after this request',
  },
  'x-credits-used': {
    schema: { type: 'integer' as const },
    description: 'Credits consumed by this request',
  },
}

const commonErrorResponses = {
  '401': {
    description: 'Unauthorized - missing or invalid API key',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  '429': {
    description: 'Rate limited - too many requests',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    headers: {
      'Retry-After': {
        schema: { type: 'integer' as const },
        description: 'Seconds to wait before retrying',
      },
    },
  },
}

const creditErrorResponses = {
  ...commonErrorResponses,
  '402': {
    description: 'Insufficient credits',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
}

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'ViralSlideMaker API',
    version: '1.0.0',
    description:
      'REST API for creating TikTok and Instagram carousel slide images from text prompts. ' +
      'Generate AI-powered content, edit slides, and download ready-to-post images.',
  },
  servers: [{ url: '/api/v1', description: 'V1 API' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      ErrorResponse: errorResponse,
      TextPosition: {
        type: 'object' as const,
        properties: {
          x: { type: 'number' as const, description: 'Percentage 0-100, from left' },
          y: { type: 'number' as const, description: 'Percentage 0-100, from top' },
        },
      },
      TextSegment: {
        type: 'object' as const,
        description: 'Per-word/per-run color span used by news-headline two-color rendering. When `accent: true`, the run renders in the template accent color; otherwise the template text color.',
        required: ['text'],
        properties: {
          text: { type: 'string' as const },
          accent: { type: 'boolean' as const, description: 'Render this run in the accent color rather than the base text color' },
        },
      },
      TextShadowEffect: {
        type: 'object' as const,
        required: ['enabled', 'color', 'size'],
        properties: {
          enabled: { type: 'boolean' as const },
          color: { type: 'string' as const, description: '8-digit hex, e.g. #00000080' },
          size: { type: 'string' as const, enum: ['sm', 'md', 'lg'] },
        },
      },
      TextOutlineEffect: {
        type: 'object' as const,
        required: ['enabled', 'color', 'width'],
        properties: {
          enabled: { type: 'boolean' as const },
          color: { type: 'string' as const, description: '6-digit hex, e.g. #000000' },
          width: { type: 'integer' as const, minimum: 1, maximum: 8, description: 'Outline thickness in px' },
        },
      },
      TextHighlightEffect: {
        type: 'object' as const,
        required: ['enabled', 'color', 'style', 'padding'],
        properties: {
          enabled: { type: 'boolean' as const },
          color: { type: 'string' as const, description: '8-digit hex with alpha, e.g. #000000CC' },
          style: { type: 'string' as const, enum: ['tight', 'full'] },
          padding: { type: 'integer' as const, minimum: 4, maximum: 24 },
        },
      },
      TextEffects: {
        type: 'object' as const,
        description: 'Composite of optional text effects applied to a hook, body, or custom text element',
        properties: {
          shadow: { $ref: '#/components/schemas/TextShadowEffect' },
          outline: { $ref: '#/components/schemas/TextOutlineEffect' },
          highlight: { $ref: '#/components/schemas/TextHighlightEffect' },
        },
      },
      StyleOverrides: {
        type: 'object' as const,
        properties: {
          hook_font_size: { type: 'number' as const },
          body_font_size: { type: 'number' as const },
          text_color: { type: 'string' as const },
          hook_text_color: { type: 'string' as const },
          body_text_color: { type: 'string' as const },
          text_position: { type: 'string' as const, enum: ['top', 'center', 'bottom'] },
          text_align: { type: 'string' as const, enum: ['left', 'center', 'right'] },
          hook_font_weight: { type: 'number' as const },
          body_font_weight: { type: 'number' as const },
          hook_font_style: { type: 'string' as const, enum: ['normal', 'italic'] },
          body_font_style: { type: 'string' as const, enum: ['normal', 'italic'] },
          hook_font_family: { type: 'string' as const },
          body_font_family: { type: 'string' as const },
          overlay_opacity: { type: 'number' as const, minimum: 0, maximum: 100 },
          hook_position: { $ref: '#/components/schemas/TextPosition' },
          body_position: { $ref: '#/components/schemas/TextPosition' },
          hook_width: { type: 'number' as const, description: 'Percentage 0-100' },
          body_width: { type: 'number' as const, description: 'Percentage 0-100' },
          hook_text_effects: { $ref: '#/components/schemas/TextEffects' },
          body_text_effects: { $ref: '#/components/schemas/TextEffects' },
          layout: {
            type: 'string' as const,
            enum: ['cover', 'body'],
            description: 'News-carousel layout variant — cover = image top + text bar bottom; body = text top + image bottom. Omit for the default safe-zone layout.',
          },
          hide_watermark: {
            type: 'boolean' as const,
            description: 'Per-slide override that suppresses the brand watermark (and the forced free-tier watermark on Free plans). Default false.',
          },
        },
      },
      CustomText: {
        type: 'object' as const,
        required: ['id', 'text', 'x', 'y', 'width'],
        properties: {
          id: { type: 'string' as const },
          text: { type: 'string' as const },
          x: { type: 'number' as const },
          y: { type: 'number' as const },
          width: { type: 'number' as const },
          font_family: { type: 'string' as const },
          font_size: { type: 'number' as const, description: 'px in the 1080x1920 reference canvas' },
          font_weight: { type: 'number' as const },
          font_style: { type: 'string' as const, enum: ['normal', 'italic'] },
          color: { type: 'string' as const },
          text_align: { type: 'string' as const, enum: ['left', 'center', 'right'] },
          text_effects: { $ref: '#/components/schemas/TextEffects' },
          segments: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/TextSegment' },
            description: 'When set, overrides plain `text` rendering with per-run two-color spans (each run inherits accent or base color from the template).',
          },
        },
      },
      CustomImage: {
        type: 'object' as const,
        required: ['id', 'url', 'x', 'y', 'width', 'height'],
        properties: {
          id: { type: 'string' as const },
          url: { type: 'string' as const },
          x: { type: 'number' as const },
          y: { type: 'number' as const },
          width: { type: 'number' as const },
          height: { type: 'number' as const },
          opacity: { type: 'number' as const, minimum: 0, maximum: 100 },
          border_radius: { type: 'number' as const },
        },
      },
      Slide: {
        type: 'object' as const,
        required: ['hook_text', 'body_text', 'image_query', 'is_cta', 'background_url', 'pexels_photo_id'],
        properties: {
          hook_text: { type: 'string' as const },
          body_text: { type: 'string' as const },
          hook_segments: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/TextSegment' },
            description: 'When set, overrides plain `hook_text` rendering with per-run two-color spans for news-headline rendering.',
          },
          body_segments: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/TextSegment' },
            description: 'When set, overrides plain `body_text` rendering with per-run two-color spans.',
          },
          image_query: { type: 'string' as const },
          is_cta: { type: 'boolean' as const },
          background_url: { type: ['string', 'null'] as const },
          pexels_photo_id: { type: ['integer', 'null'] as const },
          style_overrides: { $ref: '#/components/schemas/StyleOverrides' },
          custom_texts: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/CustomText' },
          },
          custom_images: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/CustomImage' },
          },
        },
      },
      Template: {
        type: 'object' as const,
        required: ['id', 'name', 'thumbnail', 'textPosition', 'textAlign'],
        properties: {
          id: { type: 'string' as const },
          name: { type: 'string' as const },
          thumbnail: { type: 'string' as const },
          textPosition: { type: 'string' as const, enum: ['top', 'center', 'bottom'] },
          textAlign: { type: 'string' as const, enum: ['left', 'center', 'right'] },
        },
      },
      Project: {
        type: 'object' as const,
        required: ['id', 'user_id', 'title', 'created_at', 'updated_at'],
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          user_id: { type: 'string' as const, format: 'uuid' },
          title: { type: 'string' as const },
          description: { type: ['string', 'null'] as const },
          topic: { type: ['string', 'null'] as const },
          template_id: { type: ['string', 'null'] as const },
          generation_status: {
            type: 'string' as const,
            enum: ['draft', 'generating', 'complete', 'error'],
            description: 'Lifecycle of the AI generation job that produced the current slide_data',
          },
          slides: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/Slide' },
          },
          created_at: { type: 'string' as const, format: 'date-time' },
          updated_at: { type: 'string' as const, format: 'date-time' },
        },
      },
      CarouselRequest: {
        type: 'object' as const,
        required: ['topic', 'templateId'],
        properties: {
          topic: { type: 'string' as const, minLength: 1, maxLength: 500 },
          templateId: { type: 'string' as const },
          imageSource: {
            type: 'string' as const,
            enum: ['stock', 'ai'],
            default: 'stock',
          },
          slideCount: {
            type: 'integer' as const,
            minimum: 3,
            maximum: 20,
            default: 7,
          },
          advancedOptions: {
            type: 'object' as const,
            properties: {
              font: { type: 'string' as const },
              fontColor: { type: 'string' as const },
              imagePrompt: { type: 'string' as const },
            },
          },
        },
      },
      SlidePatch: {
        type: 'object' as const,
        description: 'At least one field must be provided',
        properties: {
          hook_text: { type: 'string' as const },
          body_text: { type: 'string' as const },
          image_query: { type: 'string' as const },
          background_url: { type: 'string' as const, format: 'uri', description: 'Must use https://' },
          style_overrides: { $ref: '#/components/schemas/StyleOverrides' },
        },
      },
    },
  },
  paths: {
    '/carousel': {
      post: {
        operationId: 'createCarousel',
        summary: 'Create a carousel from a topic',
        description:
          'Generates AI slide content, fetches images, and returns a complete carousel. Costs 1 credit.',
        tags: ['Carousel'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CarouselRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Carousel created successfully. Deducts 1 credit; balance is reflected in the `x-credits-remaining` header.',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  required: ['success', 'projectId', 'slideCount'],
                  properties: {
                    success: { type: 'boolean' as const, description: 'Always true on 200; non-success outcomes use error status codes.' },
                    projectId: { type: 'string' as const, format: 'uuid', description: 'ID of the newly created project. Pass to /projects/{id}, /projects/{id}/render, /projects/{id}/download, etc.' },
                    slideCount: { type: 'integer' as const, description: 'Number of slides generated (matches the requested slideCount).' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (invalid topic, slideCount out of range, free-tier slide cap, free-tier project cap)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...creditErrorResponses,
        },
      },
    },
    '/templates': {
      get: {
        operationId: 'listTemplates',
        summary: 'List available templates',
        description: 'Returns all carousel visual style templates.',
        tags: ['Templates'],
        responses: {
          '200': {
            description: 'Template list',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'array' as const,
                      items: { $ref: '#/components/schemas/Template' },
                    },
                  },
                },
              },
            },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects': {
      get: {
        operationId: 'listProjects',
        summary: 'List all projects',
        description: 'Returns all carousel projects for the authenticated user.',
        tags: ['Projects'],
        responses: {
          '200': {
            description: 'Project list',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'array' as const,
                      items: { $ref: '#/components/schemas/Project' },
                    },
                  },
                },
              },
            },
          },
          ...commonErrorResponses,
        },
      },
      post: {
        operationId: 'createProject',
        summary: 'Create a new project',
        description: 'Creates an empty carousel project.',
        tags: ['Projects'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['title'],
                properties: {
                  title: { type: 'string' as const, minLength: 1, maxLength: 200 },
                  topic: { type: 'string' as const, maxLength: 500 },
                  templateId: { type: 'string' as const },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Project created',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        id: { type: 'string' as const, format: 'uuid' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' as const, format: 'uuid' },
          description: 'Project ID',
        },
      ],
      get: {
        operationId: 'getProject',
        summary: 'Get a project',
        description: 'Returns a single carousel project with its slide data.',
        tags: ['Projects'],
        responses: {
          '200': {
            description: 'Project details',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: { $ref: '#/components/schemas/Project' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
      delete: {
        operationId: 'deleteProject',
        summary: 'Delete a project',
        description: 'Permanently deletes a carousel project.',
        tags: ['Projects'],
        responses: {
          '200': {
            description: 'Project deleted',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        deleted: { type: 'boolean' as const },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects/{id}/slides/{index}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' as const, format: 'uuid' },
          description: 'Project ID',
        },
        {
          name: 'index',
          in: 'path',
          required: true,
          schema: { type: 'integer' as const, minimum: 0 },
          description: 'Zero-based slide index',
        },
      ],
      get: {
        operationId: 'getSlide',
        summary: 'Get a single slide',
        description: 'Returns a specific slide from a carousel project.',
        tags: ['Slides'],
        responses: {
          '200': {
            description: 'Slide data',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: { $ref: '#/components/schemas/Slide' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid slide index',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Project or slide not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
      patch: {
        operationId: 'updateSlide',
        summary: 'Update a slide',
        description:
          'Partially update a slide. At least one field must be provided.',
        tags: ['Slides'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SlidePatch' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated slide',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: { $ref: '#/components/schemas/Slide' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Project or slide not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects/{id}/render': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' as const, format: 'uuid' },
          description: 'Project ID',
        },
      ],
      post: {
        operationId: 'renderCarousel',
        summary: 'Render carousel slides',
        description:
          'Returns download URLs for all slides in a project. ' +
          'Does not consume credits -- uses already-generated data.',
        tags: ['Rendering'],
        responses: {
          '200': {
            description: 'Download URLs for all slides',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        slides: {
                          type: 'array' as const,
                          items: {
                            type: 'object' as const,
                            properties: {
                              index: { type: 'integer' as const },
                              download_url: { type: 'string' as const },
                            },
                          },
                        },
                        zip_url: { type: 'string' as const },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects/{id}/download': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' as const, format: 'uuid' },
          description: 'Project ID',
        },
      ],
      get: {
        operationId: 'downloadAllSlides',
        summary: 'Download all slides as ZIP',
        description: 'Renders all slides and returns a ZIP archive.',
        tags: ['Rendering'],
        responses: {
          '200': {
            description: 'ZIP archive containing all slide PNGs',
            headers: rateLimitHeaders,
            content: {
              'application/zip': {
                schema: {
                  type: 'string' as const,
                  format: 'binary',
                },
              },
            },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
  },
}
