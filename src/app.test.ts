import request from 'supertest';
import app from './app';
import { env } from './config/env';

describe('Test app.ts', () => {
  test('Is alive route', () => {
    return request(app)
      .get('/')
      .then((res) => {
        expect(res.body).toEqual({ message: "Miley, what's good?" });
      });
  });

  test('serves the OpenAPI document', () => {
    return request(app)
      .get('/openapi.json')
      .then((res) => {
        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.1.0');
        expect(res.body.info).toMatchObject({
          title: 'Edu-Assist API',
          version: '1.0.0',
        });
        expect(res.body.paths).toEqual(
          expect.objectContaining({
            '/api/v1/auth/me': expect.any(Object),
            '/api/v1/chat/sessions': expect.any(Object),
          }),
        );
        expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        });
        expect(res.body.servers[0].url).toBe('/');
      });
  });

  test('serves the Scalar docs UI', () => {
    return request(app)
      .get('/docs')
      .then((res) => {
        expect(res.status).toBe(200);
        expect(res.type).toBe('text/html');
        expect(res.text).toContain('Scalar API Reference');
        expect(res.text).toContain('/openapi.json');
      });
  });

  test('allows credentialed CORS preflight from the configured client origin', async () => {
    const response = await request(app)
      .options('/api/v1/chat/sessions')
      .set('Origin', env.clientUrl)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(env.clientUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
