const request = require('supertest');

jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

const { createAnonClient, createUserScopedClient } = require('../lib/supabaseClient');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'http://fake';
  process.env.SUPABASE_ANON_KEY = 'fake';
});

const app = require('../server');

describe('authMiddleware', () => {
  test('يرفض الطلب بلا رأس Authorization (401)', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  test('يرفض توكن غير صالح وفق Supabase (401)', async () => {
    createAnonClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: null, error: { message: 'invalid' } }) }
    });

    const res = await request(app).get('/api/projects').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  test('يقبل توكن صالح ويُرفق req.userId (يتحقق ضمنيًا عبر نجاح المسار التالي)', async () => {
    createAnonClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-42' } }, error: null }) }
    });
    createUserScopedClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      }))
    });

    const res = await request(app).get('/api/projects').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  test('/api/health لا يتطلب مصادقة', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
