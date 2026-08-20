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

const qualifiedRelations = [
  { id: 0, elements_used: ['أ', 'ب'], what_emerged: 'علاقة 1' }
];
const transferredMaterial = ['مادة 1'];

describe('POST /api/discover', () => {
  test('اكتشاف واحد يجتاز الحَكَم، وفكرة تنفيذ تنجح من المحاولة الأولى', async () => {
    callOpenAI.mockResolvedValueOnce({
      discoveries: [{ discovery_text: 'اكتشاف تجريبي', source_relation_ids: [0] }]
    });
    callOpenAI.mockResolvedValueOnce({
      traceable_to_material: true, derived_not_restated: true, project_specific: true, principle_not_product: true
    });
    callOpenAI.mockResolvedValueOnce({
      execution_idea: 'فكرة أولى', derivation_trace: 'سبب'
    });
    callOpenAI.mockResolvedValueOnce({ execution_idea_valid: true });

    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations, transferredMaterial });

    expect(res.status).toBe(200);
    expect(res.body.qualifiedDirections).toHaveLength(1);
    expect(res.body.qualifiedDirections[0].execution_point).toBe('فكرة أولى');
    expect(res.body.pendingDiscoveries).toHaveLength(0);
    expect(callOpenAI).toHaveBeenCalledTimes(4);
  });

  test('اكتشاف يُرفَض من حَكَم الاكتشاف نفسه — لا يصل لفكرة تنفيذ إطلاقًا', async () => {
    callOpenAI.mockResolvedValueOnce({
      discoveries: [{ discovery_text: 'اكتشاف مرفوض', source_relation_ids: [0] }]
    });
    callOpenAI.mockResolvedValueOnce({
      traceable_to_material: true, derived_not_restated: false, project_specific: true, principle_not_product: true
    });

    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations, transferredMaterial });

    expect(res.status).toBe(200);
    expect(res.body.qualifiedDirections).toHaveLength(0);
    expect(res.body.pendingDiscoveries).toHaveLength(0); // لم يصل حتى لحلقة فكرة التنفيذ
    expect(callOpenAI).toHaveBeenCalledTimes(2);
  });

  test('محاولتان مرفوضتان ثم نجاح في الثالثة — يُمرَّر rejectedAttempts للمحاولة التالية', async () => {
    callOpenAI.mockResolvedValueOnce({
      discoveries: [{ discovery_text: 'اكتشاف', source_relation_ids: [0] }]
    });
    callOpenAI.mockResolvedValueOnce({
      traceable_to_material: true, derived_not_restated: true, project_specific: true, principle_not_product: true
    });
    // محاولة 1: تُرفض
    callOpenAI.mockResolvedValueOnce({ execution_idea: 'محاولة 1', derivation_trace: 'س' });
    callOpenAI.mockResolvedValueOnce({ execution_idea_valid: false });
    // محاولة 2: تُرفض
    callOpenAI.mockResolvedValueOnce({ execution_idea: 'محاولة 2', derivation_trace: 'س' });
    callOpenAI.mockResolvedValueOnce({ execution_idea_valid: false });
    // محاولة 3: تنجح
    callOpenAI.mockResolvedValueOnce({ execution_idea: 'محاولة 3', derivation_trace: 'س' });
    callOpenAI.mockResolvedValueOnce({ execution_idea_valid: true });

    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations, transferredMaterial });

    expect(res.status).toBe(200);
    expect(res.body.qualifiedDirections).toHaveLength(1);
    expect(res.body.qualifiedDirections[0].execution_point).toBe('محاولة 3');

    // التحقق أن مدخل المحاولة الثالثة تضمّن المحاولتين المرفوضتين
    const thirdAttemptPrompt = callOpenAI.mock.calls[6][2]; // userPrompt الخاص بمولّد فكرة التنفيذ، المحاولة 3
    expect(thirdAttemptPrompt).toContain('محاولة 1');
    expect(thirdAttemptPrompt).toContain('محاولة 2');
  });

  test('استنفاد 3 محاولات دون نجاح → pendingDiscoveries لا فشل نهائي', async () => {
    callOpenAI.mockResolvedValueOnce({
      discoveries: [{ discovery_text: 'اكتشاف صعب', source_relation_ids: [0] }]
    });
    callOpenAI.mockResolvedValueOnce({
      traceable_to_material: true, derived_not_restated: true, project_specific: true, principle_not_product: true
    });
    for (let i = 0; i < 3; i++) {
      callOpenAI.mockResolvedValueOnce({ execution_idea: `محاولة ${i + 1}`, derivation_trace: 'س' });
      callOpenAI.mockResolvedValueOnce({ execution_idea_valid: false });
    }

    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations, transferredMaterial });

    expect(res.status).toBe(200);
    expect(res.body.qualifiedDirections).toHaveLength(0);
    expect(res.body.pendingDiscoveries).toHaveLength(1);
    expect(res.body.pendingDiscoveries[0].discovery_text).toBe('اكتشاف صعب');
  });

  test('execution_idea = null لا تُسجَّل كمحاولة مرفوضة، وتُستهلَك من عدّاد المحاولات', async () => {
    callOpenAI.mockResolvedValueOnce({
      discoveries: [{ discovery_text: 'اكتشاف', source_relation_ids: [0] }]
    });
    callOpenAI.mockResolvedValueOnce({
      traceable_to_material: true, derived_not_restated: true, project_specific: true, principle_not_product: true
    });
    // محاولة 1: null — لا حَكَم يُستدعى لها إطلاقًا
    callOpenAI.mockResolvedValueOnce({ execution_idea: null, derivation_trace: null });
    // محاولة 2: تنجح
    callOpenAI.mockResolvedValueOnce({ execution_idea: 'فكرة صالحة', derivation_trace: 'س' });
    callOpenAI.mockResolvedValueOnce({ execution_idea_valid: true });

    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations, transferredMaterial });

    expect(res.status).toBe(200);
    expect(res.body.qualifiedDirections).toHaveLength(1);
    // إجمالي الاستدعاءات: discGen(1) + discJudge(1) + محاولة1-gen(1، بلا حَكَم) + محاولة2-gen+judge(2) = 5
    expect(callOpenAI).toHaveBeenCalledTimes(5);

    // التأكد أن مدخل المحاولة الثانية لا يحتوي "محاولات سابقة رُفضت" لأن null لم يُسجَّل
    const secondAttemptPrompt = callOpenAI.mock.calls[3][2];
    expect(secondAttemptPrompt).not.toContain('محاولات سابقة رُفضت');
  });

  test('يرفض بلا qualifiedRelations (400)', async () => {
    const res = await request(app)
      .post('/api/discover')
      .set('Authorization', 'Bearer faketoken')
      .send({ qualifiedRelations: [] });

    expect(res.status).toBe(400);
  });
});
