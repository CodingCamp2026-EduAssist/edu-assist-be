const mockEnv = {
  inferenceApiUrl: 'https://inference.example.test',
  inferenceRequestTimeoutMs: 75_000,
};

jest.mock('../config/env', () => ({
  env: mockEnv,
}));

import { callInference } from './inference.service';

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('callInference', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  test('normalizes structured inference content into assistant text', async () => {
    const upstreamResponse = {
      content: {
        text: 'Redis is an in-memory data structure store.',
        summary: 'Structured summary from upstream',
        course_recommended: [
          {
            title: 'Redis Basics',
            skills: ['redis', 'caching'],
            rating: 4.9,
            level: 'Beginner level',
            url: 'https://example.com/redis',
            hybrid_match: '92.1%',
          },
        ],
      },
      citations: [
        {
          id: '84271ca1-f0be-4b42-b1cf-12b78b7510f8',
          sourceDocumentId: 'icEIXSuwLOm15EzpdCOPCvmGAXkJRSyhiV7Z6O2fWDepsMu8',
          chunkId: 'user_chunk_0',
          excerpt: 'Redis stores data in memory for fast access.',
          relevanceScore: 0.88,
          page: 12,
          section: null,
        },
      ],
      tokenUsage: {
        promptTokens: 12,
        completionTokens: 34,
        totalTokens: 46,
        retrievalChunks: 2,
      },
    };

    fetchMock.mockResolvedValueOnce(createJsonResponse(upstreamResponse));

    const response = await callInference({
      userMessage: {
        content: 'how redis works?',
        attachmentPaths: ['d610c3e4-8368-4077-baea-506e7f1ecb70'],
      },
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      recentTurns: [],
      conversationSummary: '',
      locale: 'en-US',
      studentProfile: {},
      linkedDocumentPaths: [],
      stream: false,
      maxTokens: 2048,
    });

    expect(response).toEqual({
      content: 'Redis is an in-memory data structure store.',
      citations: upstreamResponse.citations,
      tokenUsage: upstreamResponse.tokenUsage,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      mockEnv.inferenceApiUrl,
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test('normalizes null citations into an empty array', async () => {
    const upstreamResponse = {
      content: {
        text: 'Hyperparameter tuning is the process of adjusting model settings.',
        summary: 'Structured summary from upstream',
        course_recommended: [],
      },
      citations: null,
      tokenUsage: {
        promptTokens: 20,
        completionTokens: 40,
        totalTokens: 60,
        retrievalChunks: 3,
      },
    };

    fetchMock.mockResolvedValueOnce(createJsonResponse(upstreamResponse));

    const response = await callInference({
      userMessage: {
        content: 'what is hyper parameter tuning ?',
        attachmentPaths: ['d610c3e4-8368-4077-baea-506e7f1ecb70'],
      },
      conversationId: '123e4567-e89b-12d3-a456-426614174000',
      recentTurns: [],
      conversationSummary: '',
      locale: 'en-US',
      studentProfile: {},
      linkedDocumentPaths: [],
      stream: false,
      maxTokens: 2048,
    });

    expect(response).toEqual({
      content: 'Hyperparameter tuning is the process of adjusting model settings.',
      citations: [],
      tokenUsage: upstreamResponse.tokenUsage,
    });
  });

  test('maps aborted inference requests to 504', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    await expect(
      callInference({
        userMessage: {
          content: 'how redis works?',
          attachmentPaths: ['d610c3e4-8368-4077-baea-506e7f1ecb70'],
        },
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        recentTurns: [],
        conversationSummary: '',
        locale: 'en-US',
        studentProfile: {},
        linkedDocumentPaths: [],
        stream: false,
        maxTokens: 2048,
      }),
    ).rejects.toMatchObject({
      statusCode: 504,
      code: 'INFERENCE_TIMEOUT',
    });
  });

  test('keeps generic upstream failures as 503', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(
      callInference({
        userMessage: {
          content: 'how redis works?',
          attachmentPaths: ['d610c3e4-8368-4077-baea-506e7f1ecb70'],
        },
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        recentTurns: [],
        conversationSummary: '',
        locale: 'en-US',
        studentProfile: {},
        linkedDocumentPaths: [],
        stream: false,
        maxTokens: 2048,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'INFERENCE_UNAVAILABLE',
    });
  });
});
