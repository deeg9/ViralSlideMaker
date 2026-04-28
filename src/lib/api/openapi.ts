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
      BrandKit: {
        type: 'object' as const,
        description: 'User\'s brand kit. Drives brand-kit template rendering at slide-render time.',
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          user_id: { type: 'string' as const, format: 'uuid' },
          name: { type: ['string', 'null'] as const },
          primary_color: { type: ['string', 'null'] as const },
          secondary_color: { type: ['string', 'null'] as const },
          text_color: { type: ['string', 'null'] as const },
          background_color: { type: ['string', 'null'] as const },
          font_family: { type: ['string', 'null'] as const, description: 'Legacy single-font field; preserved for back-compat' },
          logo_url: { type: ['string', 'null'] as const, format: 'uri' },
          logo_position: {
            type: ['string', 'null'] as const,
            enum: [null, 'top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
          },
          logo_size_pct: { type: ['number', 'null'] as const, minimum: 4, maximum: 20 },
          logo_opacity_pct: { type: ['number', 'null'] as const, minimum: 10, maximum: 100 },
          heading_font_family: { type: ['string', 'null'] as const },
          body_font_family: { type: ['string', 'null'] as const },
          accent_color: { type: ['string', 'null'] as const },
          text_align: { type: ['string', 'null'] as const, enum: [null, 'left', 'center', 'right'] },
          text_position: { type: ['string', 'null'] as const, enum: [null, 'top', 'center', 'bottom'] },
          hook_style: { type: ['string', 'null'] as const, enum: [null, 'uppercase', 'normal', 'italic'] },
          overlay_opacity_pct: { type: ['number', 'null'] as const, minimum: 0, maximum: 100 },
          created_at: { type: 'string' as const, format: 'date-time' },
          updated_at: { type: 'string' as const, format: 'date-time' },
        },
      },
      Profile: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          username: { type: ['string', 'null'] as const },
          display_name: { type: ['string', 'null'] as const },
          bio: { type: ['string', 'null'] as const, maxLength: 280 },
          avatar_url: { type: ['string', 'null'] as const, format: 'uri' },
          website_url: { type: ['string', 'null'] as const, format: 'uri' },
          social_links: {
            type: 'object' as const,
            properties: {
              tiktok: { type: 'string' as const },
              instagram: { type: 'string' as const },
              x: { type: 'string' as const },
              youtube: { type: 'string' as const },
            },
          },
          created_at: { type: 'string' as const, format: 'date-time' },
        },
      },
      PublishedCarousel: {
        type: 'object' as const,
        required: ['id', 'slug', 'title', 'owner_id', 'published_at'],
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          slug: { type: 'string' as const },
          title: { type: 'string' as const },
          description: { type: ['string', 'null'] as const },
          hero_image_url: { type: ['string', 'null'] as const, format: 'uri' },
          slide_data: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/Slide' },
            description: 'Snapshot of slides at publish time. Present on the detail endpoint; omitted from the feed listing for payload-size reasons.',
          },
          tags: { type: 'array' as const, items: { type: 'string' as const } },
          owner_id: { type: 'string' as const, format: 'uuid' },
          bookmark_count: { type: 'integer' as const },
          remix_count: { type: 'integer' as const },
          view_count: { type: 'integer' as const },
          popularity_score: { type: 'number' as const },
          published_at: { type: 'string' as const, format: 'date-time' },
          creator: {
            type: ['object', 'null'] as const,
            description: 'Owner profile snippet (detail endpoint only).',
            properties: {
              username: { type: ['string', 'null'] as const },
              display_name: { type: ['string', 'null'] as const },
              avatar_url: { type: ['string', 'null'] as const, format: 'uri' },
              bio: { type: ['string', 'null'] as const },
            },
          },
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
        description: 'At least one field must be provided. Unrecognized fields are dropped server-side. style_overrides is deep-merged into the existing object; arrays (custom_texts, custom_images) replace wholesale.',
        properties: {
          hook_text: { type: 'string' as const },
          body_text: { type: 'string' as const },
          hook_segments: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/TextSegment' },
          },
          body_segments: {
            type: 'array' as const,
            items: { $ref: '#/components/schemas/TextSegment' },
          },
          image_query: { type: 'string' as const },
          background_url: { type: 'string' as const, format: 'uri', description: 'Must use https://' },
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
      patch: {
        operationId: 'updateProject',
        summary: 'Update project metadata',
        description: 'Updates `title`, `description`, and/or `template_id`. Other fields are immutable via this endpoint — use the slide endpoints to modify slide_data.',
        tags: ['Projects'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                description: 'At least one field must be provided',
                properties: {
                  title: { type: 'string' as const, minLength: 1, maxLength: 200 },
                  description: { type: ['string', 'null'] as const },
                  template_id: { type: ['string', 'null'] as const },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated project',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: { data: { $ref: '#/components/schemas/Project' } },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
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
    '/projects/{id}/slides': {
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
        operationId: 'addSlide',
        summary: 'Add a new slide',
        description: 'Appends a slide by default. Provide an optional `position` (0-based, ≤ current count) to insert at index. Optional `slide` body to seed initial fields; otherwise a blank slide is created. Hard cap of 20 slides per project.',
        tags: ['Slides'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                properties: {
                  position: { type: 'integer' as const, minimum: 0, description: 'Insertion index. Default = end of array.' },
                  slide: { $ref: '#/components/schemas/Slide' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Slide added',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        slide: { $ref: '#/components/schemas/Slide' },
                        position: { type: 'integer' as const },
                        slideCount: { type: 'integer' as const },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (max slide cap, invalid position)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/projects/{id}/slides/reorder': {
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
        operationId: 'reorderSlides',
        summary: 'Reorder slides',
        description: 'Body `{ order: number[] }` is a full permutation of the current slide indices (0..N-1, each appearing exactly once). Length must equal current slide count.',
        tags: ['Slides'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['order'],
                properties: {
                  order: {
                    type: 'array' as const,
                    items: { type: 'integer' as const, minimum: 0 },
                    description: 'Permutation of 0..N-1',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Slides reordered',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        slideCount: { type: 'integer' as const },
                        order: { type: 'array' as const, items: { type: 'integer' as const } },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'order is not a valid permutation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
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
      delete: {
        operationId: 'deleteSlide',
        summary: 'Delete a slide',
        description: 'Removes the slide at the given index and shifts subsequent indices down. Rejects when the project has only 1 slide remaining (delete the project instead).',
        tags: ['Slides'],
        responses: {
          '200': {
            description: 'Slide deleted',
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
                        slideCount: { type: 'integer' as const, description: 'New slide count after deletion' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Cannot delete the last remaining slide',
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
    '/projects/{id}/publish': {
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
        operationId: 'publishProject',
        summary: 'Publish a project to Explore',
        description: 'Pre-renders slide 1 to a public PNG hero, snapshots slide_data into a new published_carousels row, generates a slug. Idempotent against an already-published project (creates a second snapshot — call DELETE first to unpublish the existing one).',
        tags: ['Publish'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['title'],
                properties: {
                  title: { type: 'string' as const, minLength: 1, maxLength: 120 },
                  description: { type: ['string', 'null'] as const, maxLength: 500 },
                  tags: {
                    oneOf: [
                      { type: 'array' as const, items: { type: 'string' as const } },
                      { type: 'string' as const, description: 'Comma-separated alternative form' },
                    ],
                    description: 'Up to 5 tags, each 1-24 chars, lowercased + normalized server-side',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Published',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        publishedId: { type: 'string' as const, format: 'uuid' },
                        slug: { type: 'string' as const },
                        url: { type: 'string' as const, format: 'uri' },
                        hero_image_url: { type: 'string' as const, format: 'uri' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (bad title/description/tags or empty carousel)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Project not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
      delete: {
        operationId: 'unpublishProject',
        summary: 'Unpublish a project',
        description: 'Soft-deletes the active published_carousels row for this project (sets unpublished_at). Existing forks already taken are preserved. 404 if the project has no active publication.',
        tags: ['Publish'],
        responses: {
          '200': {
            description: 'Unpublished',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        unpublished_at: { type: 'string' as const, format: 'date-time' },
                        publishedId: { type: 'string' as const, format: 'uuid' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'No active published carousel for this project',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/pexels/search': {
      post: {
        operationId: 'searchPexels',
        summary: 'Search Pexels stock photos',
        description: 'Proxies a Pexels search. Free — no credits deducted.',
        tags: ['Images'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['query'],
                properties: {
                  query: { type: 'string' as const, minLength: 1, maxLength: 200 },
                  orientation: { type: 'string' as const, enum: ['landscape', 'portrait', 'square'], default: 'portrait' },
                  perPage: { type: 'integer' as const, minimum: 1, maximum: 80, default: 12 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pexels search results',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        query: { type: 'string' as const },
                        orientation: { type: 'string' as const },
                        photos: {
                          type: 'array' as const,
                          items: {
                            type: 'object' as const,
                            properties: {
                              id: { type: 'integer' as const },
                              url: { type: 'string' as const, format: 'uri' },
                              photographer: { type: 'string' as const },
                              photographer_url: { type: 'string' as const, format: 'uri' },
                              src: { type: 'object' as const, additionalProperties: { type: 'string' as const } },
                              width: { type: 'integer' as const },
                              height: { type: 'integer' as const },
                              alt: { type: 'string' as const },
                            },
                          },
                        },
                      },
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
    '/projects/{id}/slides/{index}/generate-image': {
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
      post: {
        operationId: 'generateSlideImage',
        summary: 'Generate AI background image for a slide',
        description: 'Calls Imagen 4 Fast. Body `{ prompt }` overrides the slide\'s image_query. Costs 1 credit; refunded on safety-filter or upstream errors. Persists the result to slide.background_url, sets slide.image_query, and clears pexels_photo_id.',
        tags: ['Images'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                properties: {
                  prompt: { type: 'string' as const, description: 'Override prompt; defaults to current slide.image_query' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Image generated and persisted',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        url: { type: 'string' as const, format: 'uri' },
                        prompt: { type: 'string' as const },
                        slideIndex: { type: 'integer' as const },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error or content filtered (credit refunded)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Project or slide not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...creditErrorResponses,
        },
      },
    },
    '/projects/{id}/slides/{index}/regenerate-text': {
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
      post: {
        operationId: 'regenerateSlideText',
        summary: 'AI-rewrite the slide hook + body',
        description: 'Calls Gemini 2.5 Flash to produce alternative hook_text and body_text for the slide. Free — no credits deducted. Set `persist: true` to write the result back to slide_data.',
        tags: ['Text'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                properties: {
                  customPrompt: { type: 'string' as const, description: 'Optional steering instruction (e.g. "more punchy", "rephrase as a question")' },
                  persist: { type: 'boolean' as const, default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Regenerated text',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        hook_text: { type: 'string' as const },
                        body_text: { type: 'string' as const },
                        persisted: { type: 'boolean' as const },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Project or slide not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/explore': {
      get: {
        operationId: 'listExplore',
        summary: 'List Explore feed',
        description: 'Mirrors the /explore page query. Sort by trending (popularity_score), new (published_at), or featured (is_featured = true). Optional tag filter and full-text search via search_vector.',
        tags: ['Explore'],
        parameters: [
          { name: 'sort', in: 'query', schema: { type: 'string' as const, enum: ['trending', 'new', 'featured'], default: 'trending' } },
          { name: 'tag', in: 'query', schema: { type: 'string' as const }, description: 'Filter to carousels containing this tag' },
          { name: 'q', in: 'query', schema: { type: 'string' as const }, description: 'Full-text search query (websearch syntax)' },
          { name: 'cursor', in: 'query', schema: { type: 'string' as const }, description: 'Opaque cursor from a previous response\'s next_cursor' },
        ],
        responses: {
          '200': {
            description: 'Explore feed page',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        items: { type: 'array' as const, items: { $ref: '#/components/schemas/PublishedCarousel' } },
                        next_cursor: { type: ['string', 'null'] as const },
                        sort: { type: 'string' as const },
                        tag: { type: ['string', 'null'] as const },
                        q: { type: ['string', 'null'] as const },
                      },
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
    '/explore/{slug}': {
      parameters: [
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' as const }, description: 'Carousel slug from publish' },
      ],
      get: {
        operationId: 'getPublishedCarousel',
        summary: 'Get a published carousel by slug',
        description: 'Returns the full snapshot including slide_data and a creator profile snippet.',
        tags: ['Explore'],
        responses: {
          '200': {
            description: 'Carousel detail',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: { data: { $ref: '#/components/schemas/PublishedCarousel' } },
                },
              },
            },
          },
          '404': {
            description: 'Not found (or unpublished/hidden)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/explore/{slug}/fork': {
      parameters: [
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' as const } },
      ],
      post: {
        operationId: 'forkPublishedCarousel',
        summary: 'Fork a published carousel into your dashboard',
        description: 'Deep-copies slide_data into a new private project owned by the API key holder. template_id defaults to bold-minimal so the forker\'s own brand kit re-resolves at render time. Increments remix_count on the source row.',
        tags: ['Explore'],
        responses: {
          '201': {
            description: 'Fork created',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: { projectId: { type: 'string' as const, format: 'uuid' } },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Carousel not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/me/bookmarks': {
      get: {
        operationId: 'listMyBookmarks',
        summary: 'List my bookmarks',
        description: 'Most-recent-first list of carousels the API key holder has bookmarked. Cursor-paginated with PAGE_SIZE = 24.',
        tags: ['Account'],
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string' as const }, description: 'Opaque cursor from a previous response\'s next_cursor' },
        ],
        responses: {
          '200': {
            description: 'Bookmark page',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        items: { type: 'array' as const, items: { type: 'object' as const } },
                        next_cursor: { type: ['string', 'null'] as const },
                      },
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
        operationId: 'createBookmark',
        summary: 'Bookmark a published carousel',
        description: 'Idempotent — re-bookmarking the same carousel returns 201 without erroring.',
        tags: ['Account'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['publishedId'],
                properties: {
                  publishedId: { type: 'string' as const, format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Bookmarked',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        bookmarked: { type: 'boolean' as const },
                        publishedId: { type: 'string' as const, format: 'uuid' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Carousel not found (or unpublished/hidden)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          ...commonErrorResponses,
        },
      },
    },
    '/me/bookmarks/{publishedId}': {
      parameters: [
        { name: 'publishedId', in: 'path', required: true, schema: { type: 'string' as const, format: 'uuid' } },
      ],
      delete: {
        operationId: 'deleteBookmark',
        summary: 'Remove a bookmark',
        description: 'Idempotent — deleting a non-existent bookmark returns 200 without erroring.',
        tags: ['Account'],
        responses: {
          '200': {
            description: 'Bookmark deleted',
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
                        publishedId: { type: 'string' as const, format: 'uuid' },
                      },
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
    '/me/brand-kit': {
      get: {
        operationId: 'getMyBrandKit',
        summary: 'Get my brand kit',
        description: 'Returns the caller\'s brand kit row, or null if not yet created.',
        tags: ['Account'],
        responses: {
          '200': {
            description: 'Brand kit (or null)',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      oneOf: [
                        { $ref: '#/components/schemas/BrandKit' },
                        { type: 'null' as const },
                      ],
                    },
                  },
                },
              },
            },
          },
          ...commonErrorResponses,
        },
      },
      put: {
        operationId: 'upsertMyBrandKit',
        summary: 'Upsert my brand kit',
        description: 'Creates the brand kit on first call, updates it on subsequent calls. Logo upload uses POST /me/brand-kit/logo-upload-url to obtain a signed URL, then PUT here with the resulting `logo_url`.',
        tags: ['Account'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                description: 'Any subset of BrandKit fields. Unknown fields are dropped.',
                properties: {
                  name: { type: 'string' as const },
                  primary_color: { type: ['string', 'null'] as const },
                  secondary_color: { type: ['string', 'null'] as const },
                  text_color: { type: ['string', 'null'] as const },
                  background_color: { type: ['string', 'null'] as const },
                  font_family: { type: ['string', 'null'] as const },
                  logo_url: { type: ['string', 'null'] as const, format: 'uri' },
                  logo_position: { type: ['string', 'null'] as const },
                  logo_size_pct: { type: ['number', 'null'] as const },
                  logo_opacity_pct: { type: ['number', 'null'] as const },
                  heading_font_family: { type: ['string', 'null'] as const },
                  body_font_family: { type: ['string', 'null'] as const },
                  accent_color: { type: ['string', 'null'] as const },
                  text_align: { type: ['string', 'null'] as const },
                  text_position: { type: ['string', 'null'] as const },
                  hook_style: { type: ['string', 'null'] as const },
                  overlay_opacity_pct: { type: ['number', 'null'] as const },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated brand kit',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: { data: { $ref: '#/components/schemas/BrandKit' } },
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
    '/me/brand-kit/logo-upload-url': {
      post: {
        operationId: 'createLogoUploadUrl',
        summary: 'Create a signed upload URL for the brand-kit logo',
        description: 'Returns a signed PUT URL the client uses to upload directly to the brand-kit-logos bucket. After uploading, call PUT /me/brand-kit with `logo_url` set to the returned `publicUrl`.',
        tags: ['Account'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                properties: {
                  filename: { type: 'string' as const, default: 'logo.png' },
                  contentType: { type: 'string' as const, enum: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], default: 'image/png' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signed upload URL',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        uploadUrl: { type: 'string' as const, format: 'uri' },
                        token: { type: 'string' as const },
                        method: { type: 'string' as const, enum: ['PUT'] },
                        headers: { type: 'object' as const, additionalProperties: { type: 'string' as const } },
                        publicUrl: { type: 'string' as const, format: 'uri' },
                        path: { type: 'string' as const },
                      },
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
    '/me/profile': {
      get: {
        operationId: 'getMyProfile',
        summary: 'Get my public profile',
        description: 'Returns display_name, bio, avatar_url, website_url, social_links from the public.profiles row.',
        tags: ['Account'],
        responses: {
          '200': {
            description: 'Profile (or null if not yet created — e.g. user hasn\'t claimed a username)',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      oneOf: [
                        { $ref: '#/components/schemas/Profile' },
                        { type: 'null' as const },
                      ],
                    },
                  },
                },
              },
            },
          },
          ...commonErrorResponses,
        },
      },
      patch: {
        operationId: 'updateMyProfile',
        summary: 'Update my public profile',
        description: 'Updates display_name, bio, avatar_url, website_url, and/or social_links. Username has its own claim flow (see /onboarding/username) and cannot be changed via this endpoint.',
        tags: ['Account'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                description: 'At least one field must be provided',
                properties: {
                  display_name: { type: ['string', 'null'] as const },
                  bio: { type: ['string', 'null'] as const, maxLength: 280 },
                  avatar_url: { type: ['string', 'null'] as const, format: 'uri' },
                  website_url: { type: ['string', 'null'] as const, format: 'uri' },
                  social_links: {
                    type: 'object' as const,
                    properties: {
                      tiktok: { type: 'string' as const },
                      instagram: { type: 'string' as const },
                      x: { type: 'string' as const },
                      youtube: { type: 'string' as const },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated profile',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: { data: { $ref: '#/components/schemas/Profile' } },
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
    '/me/credits': {
      get: {
        operationId: 'getMyCredits',
        summary: 'Get my credit balance + tier',
        description: 'Returns the current user\'s subscription tier, credit balance, and the monthly grant amount for that tier.',
        tags: ['Account'],
        responses: {
          '200': {
            description: 'Credit summary',
            headers: rateLimitHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    data: {
                      type: 'object' as const,
                      properties: {
                        tier: { type: 'string' as const, enum: ['free', 'plus', 'pro'] },
                        balance: { type: 'integer' as const, minimum: 0 },
                        monthly_grant: { type: 'integer' as const, minimum: 0 },
                        period_end: { type: ['string', 'null'] as const, format: 'date-time' },
                        status: { type: ['string', 'null'] as const },
                        cancel_at_period_end: { type: ['boolean', 'null'] as const },
                      },
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
  },
}
