import request from 'supertest';
import app from '../app';

describe('Document routes', () => {
  test('Document listing requires authentication', async () => {
    return request(app)
      .get('/api/v1/documents')
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

  test('Document upload requires authentication', async () => {
    return request(app)
      .post('/api/v1/documents')
      .send({})
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
});
