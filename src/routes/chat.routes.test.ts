import request from 'supertest';

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

describe('Chat routes', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const guestSessionId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockRedisCounts.clear();
    jest.clearAllMocks();
  });

  test('Guest session listing requires a guestSessionId when not authenticated', async () => {
    const response = await request(app).get('/api/v1/chat/sessions');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'guestSessionId is required for guest sessions',
        code: 'GUEST_SESSION_REQUIRED',
      }),
    );
  });

  test('Message sending rejects an invalid payload before hitting the database', async () => {
    const response = await request(app)
      .post(`/api/v1/chat/sessions/${sessionId}/messages`)
      .query({ guestSessionId })
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid chat message payload');
  });

  test('Message sending is rate limited after 30 requests in the same window', async () => {
    const endpoint = `/api/v1/chat/sessions/${sessionId}/messages?guestSessionId=${guestSessionId}`;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app).post(endpoint).send({});
    }

    const limitedResponse = await request(app).post(endpoint).send({});

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
