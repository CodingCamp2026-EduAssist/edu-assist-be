import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  CreateConversationRequestDto,
  CreateConversationResponseDto,
} from '../dtos/create.conversation.dto';
import { PostMessageRequestDto, PostMessageResponseDto } from '../dtos/post.message.dto';
import {
  ListDocumentsQuerySchema,
  ListDocumentsResponseSchema,
  UploadDocumentResponseSchema,
  UploadBatchDocumentsResponseSchema,
  DeleteDocumentBodySchema,
} from '../dtos/document.dto';
import { StudentProfileSchema } from '../models/studentProfiles';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const apiBasePath = '/api/v1';
const authBasePath = `${apiBasePath}/auth`;
const chatBasePath = `${apiBasePath}/chat`;
const profileBasePath = `${apiBasePath}/profiles`;
const documentBasePath = `${apiBasePath}/documents`;

function bearerSecurityRequirement() {
  return [{ [bearerAuth.name]: [] }];
}

const isoDateTime = z.iso.datetime();

function jsonResponse(schema: z.ZodTypeAny, description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema,
      },
    },
  } as const;
}

const authUserSchema = registry.register(
  'AuthUser',
  z
    .object({
      id: z.uuid(),
      email: z.email(),
      name: z.string().min(1),
    })
    .strict(),
);

const apiErrorSchema = registry.register(
  'ApiError',
  z
    .object({
      error: z.string().min(1),
      code: z.string().optional(),
      details: z.any().optional(),
      path: z.string().optional(),
      issues: z.array(z.any()).optional(),
    })
    .strict(),
);

const refreshResponseSchema = registry.register(
  'AuthRefreshResponse',
  z
    .object({
      accessToken: z.string().min(1),
    })
    .strict(),
);

const logoutResponseSchema = registry.register(
  'AuthLogoutResponse',
  z
    .object({
      message: z.string().min(1),
    })
    .strict(),
);

const usersListSchema = registry.register('UsersList', z.array(z.string().min(1)));

const clientMessageSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(['user', 'assistant'] as const),
    content: z.string().min(1).max(8000),
    citationIds: z.array(z.uuid()).max(50).optional(),
    createdAt: isoDateTime,
  })
  .strict();

const chatSessionListItemSchema = registry.register(
  'ChatSessionListItem',
  z
    .object({
      conversationId: z.uuid(),
      title: z.string().nullable(),
      status: z.enum(['active', 'archived'] as const),
      summary: z.string().nullable(),
      lastMessageAt: isoDateTime.nullable(),
      createdAt: isoDateTime,
      updatedAt: isoDateTime,
      messageCount: z.number().int().nonnegative(),
    })
    .strict(),
);

const chatSessionListResponseSchema = registry.register(
  'ChatSessionListResponse',
  z
    .object({
      sessions: z.array(chatSessionListItemSchema),
    })
    .strict(),
);

const chatSessionMessagesResponseSchema = registry.register(
  'ChatSessionMessagesResponse',
  z
    .object({
      conversationId: z.uuid(),
      messages: z.array(clientMessageSchema),
    })
    .strict(),
);

const resumeConversationResponseSchema = registry.register(
  'ResumeConversationResponse',
  z
    .object({
      conversationId: z.uuid(),
      title: z.string().optional(),
      summary: z.string().optional(),
      createdAt: isoDateTime,
      updatedAt: isoDateTime,
      status: z.enum(['resumed', 'archived'] as const),
      messageCount: z.number().int().nonnegative(),
      recentMessages: z.array(clientMessageSchema),
    })
    .strict(),
);

const profileResponseSchema = registry.register(
  'StudentProfileResponse',
  z
    .object({
      profile: StudentProfileSchema,
    })
    .strict(),
);

function registerAuthDocumentation() {
  registry.registerPath({
    method: 'get',
    path: `${authBasePath}/google`,
    tags: ['auth'],
    summary: 'Start Google login',
    description: 'Redirects the caller to the Google OAuth consent screen.',
    responses: {
      302: {
        description: 'Redirects to Google OAuth',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${authBasePath}/google/callback`,
    tags: ['auth'],
    summary: 'Complete Google login',
    description:
      'Handles the OAuth callback, sets the refresh cookie, and redirects to the client app.',
    responses: {
      302: {
        description: 'Redirects to the client callback URL',
      },
      401: jsonResponse(apiErrorSchema, 'Google authentication failed'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${authBasePath}/refresh`,
    tags: ['auth'],
    summary: 'Refresh an access token',
    description: 'Reads the refresh token cookie and rotates the current session.',
    request: {
      cookies: z
        .object({
          refresh_token: z.string().min(1),
        })
        .strict(),
    },
    responses: {
      200: jsonResponse(refreshResponseSchema, 'New access token'),
      401: jsonResponse(apiErrorSchema, 'Refresh token is missing or invalid'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${authBasePath}/failure`,
    tags: ['auth'],
    summary: 'Handle Google login failure',
    responses: {
      401: jsonResponse(apiErrorSchema, 'Google authentication failed'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${authBasePath}/logout`,
    tags: ['auth'],
    summary: 'Log out the current user',
    security: bearerSecurityRequirement(),
    responses: {
      200: jsonResponse(logoutResponseSchema, 'Logout succeeded'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${authBasePath}/me`,
    tags: ['auth'],
    summary: 'Return the current user',
    security: bearerSecurityRequirement(),
    responses: {
      200: jsonResponse(
        z
          .object({
            user: authUserSchema,
          })
          .strict(),
        'Authenticated user',
      ),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
    },
  });
}

function registerUserDocumentation() {
  registry.registerPath({
    method: 'get',
    path: `${apiBasePath}/users`,
    tags: ['users'],
    summary: 'List sample users',
    responses: {
      200: jsonResponse(usersListSchema, 'Sample user list'),
    },
  });
}

function registerProfileDocumentation() {
  const updateProfileSchema = StudentProfileSchema.partial().strict();

  registry.registerPath({
    method: 'get',
    path: `${profileBasePath}/me`,
    tags: ['profiles'],
    summary: 'Return the current student profile',
    description:
      "Returns the authenticated user's persisted student profile, or defaults if none exists yet.",
    security: bearerSecurityRequirement(),
    responses: {
      200: jsonResponse(profileResponseSchema, 'Student profile'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: `${profileBasePath}/me`,
    tags: ['profiles'],
    summary: 'Update the current student profile',
    description: "Partially updates the authenticated user's persisted student profile.",
    security: bearerSecurityRequirement(),
    request: {
      body: {
        content: {
          'application/json': {
            schema: updateProfileSchema,
          },
        },
      },
    },
    responses: {
      200: jsonResponse(profileResponseSchema, 'Updated student profile'),
      400: jsonResponse(apiErrorSchema, 'Invalid student profile payload'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
    },
  });
}

function registerDocumentDocumentation() {
  registry.registerPath({
    method: 'get',
    path: `${documentBasePath}/`,
    tags: ['documents'],
    summary: 'List documents',
    description: 'Returns a paginated list of documents for the authenticated user.',
    security: bearerSecurityRequirement(),
    request: {
      query: ListDocumentsQuerySchema,
    },
    responses: {
      200: jsonResponse(ListDocumentsResponseSchema, 'List of documents'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${documentBasePath}/`,
    tags: ['documents'],
    summary: 'Upload a single document',
    description: 'Uploads a single document file (PDF, DOCX, TXT, or MD).',
    security: bearerSecurityRequirement(),
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any(),
            }),
          },
        },
      },
    },
    responses: {
      201: jsonResponse(UploadDocumentResponseSchema, 'Document uploaded successfully'),
      400: jsonResponse(apiErrorSchema, 'Invalid document payload or unsupported file type'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
      413: jsonResponse(apiErrorSchema, 'File size exceeds the maximum allowed'),
      500: jsonResponse(apiErrorSchema, 'Document upload failed'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${documentBasePath}/batch`,
    tags: ['documents'],
    summary: 'Upload multiple documents',
    description:
      'Uploads up to 10 document files in a single request. Each file is processed independently.',
    security: bearerSecurityRequirement(),
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              files: z.array(z.any()),
            }),
          },
        },
      },
    },
    responses: {
      207: jsonResponse(UploadBatchDocumentsResponseSchema, 'Batch upload completed'),
      400: jsonResponse(apiErrorSchema, 'Invalid document payload or unsupported file type'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
      413: jsonResponse(apiErrorSchema, 'File size exceeds the maximum allowed'),
      500: jsonResponse(apiErrorSchema, 'Document batch upload failed'),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: `${documentBasePath}/`,
    tags: ['documents'],
    summary: 'Delete documents',
    description:
      "Deletes documents by their S3 file keys. Matches keys against the authenticated user's documents.",
    security: bearerSecurityRequirement(),
    request: {
      body: {
        content: {
          'application/json': {
            schema: DeleteDocumentBodySchema,
          },
        },
      },
    },
    responses: {
      204: { description: 'Documents deleted successfully' },
      400: jsonResponse(apiErrorSchema, 'fileKeys must be an array of strings'),
      401: jsonResponse(apiErrorSchema, 'Authentication required'),
      404: jsonResponse(apiErrorSchema, 'No matching documents found'),
      500: jsonResponse(apiErrorSchema, 'Document deletion failed'),
    },
  });
}

function registerChatDocumentation() {
  const chatLimitQuerySchema = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict();

  const chatParamsSchema = z
    .object({
      sessionId: z.uuid(),
    })
    .strict();

  registry.registerPath({
    method: 'post',
    path: `${chatBasePath}/sessions`,
    tags: ['chat'],
    summary: 'Create a conversation session',
    description: 'Creates a chat session for the authenticated user.',
    security: bearerSecurityRequirement(),
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateConversationRequestDto,
          },
        },
      },
    },
    responses: {
      201: jsonResponse(CreateConversationResponseDto, 'Conversation session created'),
      400: jsonResponse(apiErrorSchema, 'Invalid chat session payload'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${chatBasePath}/sessions`,
    tags: ['chat'],
    summary: 'List conversation sessions',
    description: 'Returns sessions for the authenticated user.',
    security: bearerSecurityRequirement(),
    request: {
      query: chatLimitQuerySchema,
    },
    responses: {
      200: jsonResponse(chatSessionListResponseSchema, 'Conversation sessions'),
      400: jsonResponse(apiErrorSchema, 'Invalid chat session query parameters'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${chatBasePath}/sessions/{sessionId}`,
    tags: ['chat'],
    summary: 'Resume a conversation session',
    description: 'Returns the recent conversation history for the requested session.',
    security: bearerSecurityRequirement(),
    request: {
      params: chatParamsSchema,
      query: chatLimitQuerySchema,
    },
    responses: {
      200: jsonResponse(resumeConversationResponseSchema, 'Conversation history'),
      400: jsonResponse(apiErrorSchema, 'Invalid chat session query parameters'),
      404: jsonResponse(apiErrorSchema, 'Conversation session not found'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${chatBasePath}/sessions/{sessionId}/messages`,
    tags: ['chat'],
    summary: 'List the messages in a session',
    security: bearerSecurityRequirement(),
    request: {
      params: chatParamsSchema,
      query: chatLimitQuerySchema,
    },
    responses: {
      200: jsonResponse(chatSessionMessagesResponseSchema, 'Session messages'),
      400: jsonResponse(apiErrorSchema, 'Invalid chat session query parameters'),
      404: jsonResponse(apiErrorSchema, 'Conversation session not found'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${chatBasePath}/sessions/{sessionId}/messages`,
    tags: ['chat'],
    summary: 'Send a message to a session',
    description:
      'Creates a user message, calls inference, and returns the assistant response. Streaming is not implemented yet.',
    security: bearerSecurityRequirement(),
    request: {
      params: chatParamsSchema,
      body: {
        content: {
          'application/json': {
            schema: PostMessageRequestDto,
          },
        },
      },
    },
    responses: {
      201: jsonResponse(PostMessageResponseDto, 'Assistant response'),
      400: jsonResponse(apiErrorSchema, 'Invalid chat message payload'),
      404: jsonResponse(apiErrorSchema, 'Conversation session not found'),
      501: jsonResponse(apiErrorSchema, 'Streaming responses are not implemented yet'),
    },
  });
}

registerAuthDocumentation();
registerUserDocumentation();
registerProfileDocumentation();
registerChatDocumentation();
registerDocumentDocumentation();

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Edu-Assist API',
      version: '1.0.0',
      description: 'Backend API documentation for Edu-Assist.',
    },
    tags: [
      {
        name: 'auth',
        description: 'Authentication and session management endpoints',
      },
      {
        name: 'users',
        description: 'User-facing endpoints',
      },
      {
        name: 'profiles',
        description: 'Persistent student profile endpoints',
      },
      {
        name: 'chat',
        description: 'Conversation and messaging endpoints',
      },
      {
        name: 'documents',
        description: 'Document upload, listing, and deletion endpoints',
      },
    ],
    servers: [
      {
        url: '/',
        description: 'Current origin',
      },
    ],
  });
}
