const request = require('supertest');

jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

const { callOpenAI } = require('../lib/openaiClient');
const { createAnonClient, createUserScopedClient } = require('../lib/supabaseClient');

function fakeSupabase() {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
      insert: jest.fn().mockResolvedValue({ error: null })
    }))
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const fake = fakeSupabase();
  createAnonClient.mockReturnValue(fake);
  createUserScopedClient.mockReturnValue(fake);
  process.env.SUPABASE_URL = 'http://fake';
  process.env.SUPABASE_ANON_KEY = 'fake';
  process.env.OPENAI_API_KEY = 'fake-key';
});

const app = require('../server');

describe('POST /api/explore', () => {
  test('يبني qualified_relations فقط من المرشحين الذين اجتازا كلا الحكمين', async () => {
    // المولّد يُنتج مرشحين
    callOpenAI.mockResolvedValueOnce({
      candidate_relations: [
        { elements_used: ['أ', 'ب'], what_emerged: 'علاقة 1' },
        { elements_used: ['ج', 'د'], what_emerged: 'علاقة 2' }
      ]
    });
    // الحَكَم: المرشح الأول يجتاز، الثاني يُرفض
    callOpenAI.mockResolvedValueOnce({
      verdicts: [{ traceable_to_material: true, valid_inference: true }]
    });
    callOpenAI.mockResolvedValueOnce({
      verdicts: [{ traceable_to_material: true, valid_inference: false }]
    });

    const res = await request(app)
      .post('/api/explore')
      .set('Authorization', 'Bearer faketoken')
      .send({ breakdown: ['أ', 'ب', 'ج', 'د'] });

    expect(res.status).toBe(200);
    expect(res.body.candidates_generated).toBe(2);
    expect(res.body.qualified_relations).toHaveLength(1);
    expect(res.body.qualified_relations[0].what_emerged).toBe('علاقة 1');
    expect(res.body.qualified_relations[0].id).toBe(0); // معرّف تسلسلي يبدأ من 0
    expect(callOpenAI).toHaveBeenCalledTimes(3); // مولّد واحد + حَكَم لكل مرشح (2)
  });

  test('صفر مرشحين مؤهلين حالة صحيحة (200، مصفوفة فارغة)', async () => {
    callOpenAI.mockResolvedValueOnce({ candidate_relations: [] });

    const res = await request(app)
      .post('/api/explore')
      .set('Authorization', 'Bearer faketoken')
      .send({ breakdown: ['أ', 'ب'] });

    expect(res.status).toBe(200);
    expect(res.body.qualified_relations).toHaveLength(0);
  });

  test('يرفض بلا breakdown صالح (400)', async () => {
    const res = await request(app)
      .post('/api/explore')
      .set('Authorization', 'Bearer faketoken')
      .send({ breakdown: [] });

    expect(res.status).toBe(400);
  });
});
