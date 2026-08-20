const request = require('supertest');

jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

const { createAnonClient, createUserScopedClient } = require('../lib/supabaseClient');

function fakeSupabase() {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const fake = fakeSupabase();
  createAnonClient.mockReturnValue(fake);
  createUserScopedClient.mockReturnValue(fake);
  process.env.SUPABASE_URL = 'http://fake';
  process.env.SUPABASE_ANON_KEY = 'fake';
});

const app = require('../server');

describe('POST /api/approve', () => {
  test('يحوّل كل عناصر qualifiedDirections جماعيًا مع طابع زمني وبيانات المشروع', async () => {
    const res = await request(app)
      .post('/api/approve')
      .set('Authorization', 'Bearer faketoken')
      .send({
        qualifiedDirections: [
          { source: '0', discovery_text: 'اكتشاف 1', execution_point: 'فكرة 1', selection_reason: 'سبب 1' },
          { source: '1', discovery_text: 'اكتشاف 2', execution_point: 'فكرة 2', selection_reason: 'سبب 2' }
        ],
        startingPointLabel: 'الاسم',
        projectName: 'مسار'
      });

    expect(res.status).toBe(200);
    expect(res.body.approvedDirections).toHaveLength(2);
    res.body.approvedDirections.forEach(d => {
      expect(d.starting_point).toBe('الاسم');
      expect(d.project_name).toBe('مسار');
      expect(d.approved_at).toBeTruthy();
    });
  });

  test('يرفض قائمة فارغة (400)', async () => {
    const res = await request(app)
      .post('/api/approve')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedDirections: [] });

    expect(res.status).toBe(400);
  });
});
