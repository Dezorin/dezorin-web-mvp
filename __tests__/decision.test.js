const request = require('supertest');

// محاكاة طبقتي الشبكة الخارجيتين فقط (OpenAI + Supabase) — لا شيء آخر
jest.mock('../lib/openaiClient');
jest.mock('../lib/supabaseClient');

const { callOpenAI } = require('../lib/openaiClient');
const { createAnonClient, createUserScopedClient } = require('../lib/supabaseClient');

function fakeAuthenticatedSupabase() {
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
  const fake = fakeAuthenticatedSupabase();
  createAnonClient.mockReturnValue(fake);
  createUserScopedClient.mockReturnValue(fake);
  process.env.SUPABASE_URL = 'http://fake';
  process.env.SUPABASE_ANON_KEY = 'fake';
  process.env.OPENAI_API_KEY = 'fake-key';
});

const app = require('../server');

function makeCandidates(scores) {
  const conditions = (arr) => arr.map((s, i) => ({ id: `c${i}`, evidence: 'x', reason: 'y', score: s }));
  return {
    name: { label: 'الاسم', conditions: conditions(scores.name) },
    letter: { label: 'الحرف', conditions: conditions(scores.letter) },
    product: { label: 'المنتج', conditions: conditions(scores.product) },
    value: { label: 'القيمة', conditions: conditions(scores.value) }
  };
}

const validBody = { projName: 'مسار', q1: 'a', q2: 'b', q3: 'c', q4: 'd' };

describe('POST /api/decision', () => {
  test('يرفض الطلب بلا توكن مصادقة (401)', async () => {
    const res = await request(app).post('/api/decision').send(validBody);
    expect(res.status).toBe(401);
  });

  test('فائز واحد واضح — بلا كسر تعادل، بلا استدعاء ثانٍ', async () => {
    // 3 شروط لكل مرشح، حد أقصى 6 لكل مرشح (يطابق بنية v0.1 الفعلية: 12 شرطًا / 4 مرشحين)
    callOpenAI.mockResolvedValueOnce({
      candidates: makeCandidates({ name: [2, 2, 1], letter: [0, 0, 0], product: [1, 0, 0], value: [1, 0, 0] })
    });

    const res = await request(app)
      .post('/api/decision')
      .set('Authorization', 'Bearer faketoken')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.starting_point).toBe('name');
    expect(res.body.tie_break_applied).toBe(false);
    expect(res.body.insufficient_result).toBe(false);
    expect(callOpenAI).toHaveBeenCalledTimes(1); // لا كسر تعادل
  });

  test('مجموع أقل من 4 للجميع — insufficient_result = true', async () => {
    callOpenAI.mockResolvedValueOnce({
      candidates: makeCandidates({ name: [1, 0], letter: [0, 0], product: [0, 0], value: [1, 0] })
    });

    const res = await request(app)
      .post('/api/decision')
      .set('Authorization', 'Bearer faketoken')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.insufficient_result).toBe(true);
    expect(res.body.starting_point).toBeNull();
  });

  test('تعادل حقيقي — يُستدعى TIE_BREAK وتُطبَّق نتيجته', async () => {
    callOpenAI
      .mockResolvedValueOnce({
        candidates: makeCandidates({ name: [2, 2, 0], letter: [2, 2, 0], product: [0, 0, 0], value: [0, 0, 0] }) // name=4, letter=4 تعادل حقيقي فوق العتبة
      })
      .mockResolvedValueOnce({ winner: 'letter', tie_break_reason: 'سبب تجريبي' });

    const res = await request(app)
      .post('/api/decision')
      .set('Authorization', 'Bearer faketoken')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.tie_break_applied).toBe(true);
    expect(res.body.starting_point).toBe('letter');
    expect(res.body.tie_break_reason).toBe('سبب تجريبي');
    expect(callOpenAI).toHaveBeenCalledTimes(2);
  });

  test('يرفض طلبًا ناقص الحقول (400)', async () => {
    const res = await request(app)
      .post('/api/decision')
      .set('Authorization', 'Bearer faketoken')
      .send({ projName: 'مسار' }); // بلا أسئلة

    expect(res.status).toBe(400);
  });
});
