import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../config/env';

type MockRedisEvalOptions = {
  keys: string[];
  arguments: string[];
};

const mockRedisCounts = new Map<string, number>();

const mockRedisClient = {
  eval: jest.fn(async (_script: string, options: MockRedisEvalOptions) => {
    const key = options.keys[0];
    const currentCount = (mockRedisCounts.get(key) ?? 0) + 1;
    mockRedisCounts.set(key, currentCount);

    return [currentCount, 60_000] as [number, number];
  }),
};

const mockGetRedisClient = jest.fn(async () => mockRedisClient);

jest.mock('../lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
}));

import app from '../app';

const authHeaders = {
  Authorization: `Bearer ${jwt.sign(
    {
      sub: '11111111-1111-4111-8111-111111111112',
      email: 'test.student@example.com',
      name: 'Test Student',
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
    },
  )}`,
};

describe('Chat routes', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const emptyPayload = {};

  const authenticatedPost = (endpoint: string) => request(app).post(endpoint).set(authHeaders);

  beforeEach(() => {
    mockRedisCounts.clear();
    jest.clearAllMocks();
  });

  test.each([
    { method: 'get', endpoint: '/api/v1/chat/sessions' },
    { method: 'post', endpoint: '/api/v1/chat/sessions' },
    { method: 'get', endpoint: `/api/v1/chat/sessions/${sessionId}` },
    { method: 'get', endpoint: `/api/v1/chat/sessions/${sessionId}/messages` },
    { method: 'post', endpoint: `/api/v1/chat/sessions/${sessionId}/messages` },
  ])('$method $endpoint requires authentication', async ({ method, endpoint }) => {
    const responsePromise =
      method === 'post' ? request(app).post(endpoint).send({}) : request(app).get(endpoint);

    return responsePromise.then((response) => {
      expect(response.status).toBe(401);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        }),
      );
    });
  });

  test('Message sending rejects an invalid payload before hitting the database', async () => {
    const response = await authenticatedPost(`/api/v1/chat/sessions/${sessionId}/messages`).send(
      emptyPayload,
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid chat message payload');
  });

  test('Message sending is rate limited after 30 requests in the same window', async () => {
    const endpoint = `/api/v1/chat/sessions/${sessionId}/messages`;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await authenticatedPost(endpoint).send(emptyPayload);
    }

    const limitedResponse = await authenticatedPost(endpoint).send(emptyPayload);

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual(
      expect.objectContaining({
        error: 'Too many chat message requests. Please try again later.',
        retryAfterSeconds: expect.any(Number),
      }),
    );
    expect(limitedResponse.headers['ratelimit-limit']).toBe('30');
    expect(limitedResponse.headers['ratelimit-remaining']).toBe('0');
    expect(limitedResponse.headers['retry-after']).toBeDefined();
  });
});
