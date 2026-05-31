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

describe('Profile routes', () => {
  beforeEach(() => {
    mockRedisCounts.clear();
    jest.clearAllMocks();
  });

  test('GET /api/v1/profiles/me requires authentication', async () => {
    return request(app)
      .get('/api/v1/profiles/me')
      .then((response) => {
        expect(response.status).toBe(401);
        expect(response.body).toEqual(
          expect.objectContaining({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          }),
        );
      });
  });

  test('PATCH /api/v1/profiles/me rejects invalid payloads for authenticated users', async () => {
    const response = await request(app)
      .patch('/api/v1/profiles/me')
      .set(authHeaders)
      .send({ pace: 'wild' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid student profile payload');
  });
});
