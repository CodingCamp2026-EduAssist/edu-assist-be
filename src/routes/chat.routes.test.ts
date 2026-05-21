import request from 'supertest';
import app from '../app';

describe('Chat routes', () => {
  test('Guest session listing requires a guestSessionId when not authenticated', async () => {
    const response = await Promise.resolve(request(app).get('/api/v1/chat/sessions'));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'guestSessionId is required for guest sessions',
    });
  });

  test('Message sending rejects an invalid payload before hitting the database', async () => {
    const response = await Promise.resolve(
      request(app)
        .post('/api/v1/chat/sessions/example-session/messages')
        .query({ guestSessionId: 'guest-session-1' })
        .send({}),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid chat message payload');
  });
});
