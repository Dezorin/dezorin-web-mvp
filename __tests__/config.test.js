const request = require('supertest');

jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

beforeEach(() => {
  jest.clearAllMocks();
});

const app = require('../server');

describe('GET /api/config', () => {
  test('لا يتطلب مصادقة، ويعيد supabaseUrl وsupabaseAnonKey من البيئة', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-public-key-123';

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body.supabaseUrl).toBe('https://example.supabase.co');
    expect(res.body.supabaseAnonKey).toBe('anon-public-key-123');
  });

  test('لا يكشف SUPABASE_SERVICE_ROLE_KEY حتى لو كان موجودًا في البيئة', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-public-key-123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role-value';

    const res = await request(app).get('/api/config');

    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain('super-secret-service-role-value');
    expect(Object.keys(res.body).sort()).toEqual(['supabaseAnonKey', 'supabaseUrl']);

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test('يعيد null بدل رمي خطأ إن كانت المتغيرات غير مضبوطة', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body.supabaseUrl).toBeNull();
    expect(res.body.supabaseAnonKey).toBeNull();
  });
});
