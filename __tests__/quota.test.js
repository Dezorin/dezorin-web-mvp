const request = require('supertest');

jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

const { callOpenAI } = require('../lib/openaiClient');
const { createAnonClient, createUserScopedClient } = require('../lib/supabaseClient');

function fakeSupabaseWithUsageCount(count) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ count, error: null }),
      insert: jest.fn().mockResolvedValue({ error: null })
    }))
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'http://fake';
  process.env.SUPABASE_ANON_KEY = 'fake';
  process.env.OPENAI_API_KEY = 'fake-key';
  delete process.env.DAILY_AI_SAFETY_LIMIT; // القيمة الافتراضية 500
});

const app = require('../server');

describe('quotaMiddleware', () => {
  test('يرفض الطلب (429) عند بلوغ حد الأمان، بلا استدعاء OpenAI إطلاقًا', async () => {
    process.env.DAILY_AI_SAFETY_LIMIT = '5';
    const fake = fakeSupabaseWithUsageCount(5); // بلغ الحد بالضبط
    createAnonClient.mockReturnValue(fake);
    createUserScopedClient.mockReturnValue(fake);

    const res = await request(app)
      .post('/api/stage1')
      .set('Authorization', 'Bearer faketoken')
      .send({ winnerLabel: 'x', q1: 'a', q2: 'b', q3: 'c', q4: 'd' });

    expect(res.status).toBe(429);
    expect(callOpenAI).not.toHaveBeenCalled();
  });

  test('يسمح بالطلب عند عدم بلوغ الحد', async () => {
    process.env.DAILY_AI_SAFETY_LIMIT = '5';
    const fake = fakeSupabaseWithUsageCount(2);
    createAnonClient.mockReturnValue(fake);
    createUserScopedClient.mockReturnValue(fake);
    callOpenAI.mockResolvedValueOnce({ transferred_material: ['شيء'] });

    const res = await request(app)
      .post('/api/stage1')
      .set('Authorization', 'Bearer faketoken')
      .send({ winnerLabel: 'x', q1: 'a', q2: 'b', q3: 'c', q4: 'd' });

    expect(res.status).toBe(200);
  });

  test('فشل استعلام فحص الاستهلاك لا يمنع الاستخدام (حد أمان لا بوابة صارمة)', async () => {
    const fake = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: null, error: { message: 'db down' } }),
        insert: jest.fn().mockResolvedValue({ error: null })
      }))
    };
    createAnonClient.mockReturnValue(fake);
    createUserScopedClient.mockReturnValue(fake);
    callOpenAI.mockResolvedValueOnce({ transferred_material: ['شيء'] });

    const res = await request(app)
      .post('/api/stage1')
      .set('Authorization', 'Bearer faketoken')
      .send({ winnerLabel: 'x', q1: 'a', q2: 'b', q3: 'c', q4: 'd' });

    expect(res.status).toBe(200);
  });
});
