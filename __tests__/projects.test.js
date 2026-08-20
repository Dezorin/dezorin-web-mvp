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

const sampleState = {
  id: 'proj_1', projectName: 'مسار', savedAt: '2026-01-01T00:00:00Z', currentStage: 'stage1',
  form: { projName: 'مسار', projField: '', projProduct: '', q1: 'a', q2: 'b', q3: 'c', q4: 'd' },
  state: {
    lastResult: null, lastProject: 'مسار', stage1Result: null, stage2Result: null,
    explorationResult: null, discoveryResults: null, qualifiedDirections: null,
    pendingDiscoveries: null, approvedDirections: null
  }
};

function setupSupabase(overrides = {}) {
  const fake = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: overrides.order || jest.fn().mockResolvedValue({ data: [], error: null }),
      single: overrides.single || jest.fn().mockResolvedValue({ data: { id: 'p1', ...sampleState }, error: null })
    }))
  };
  createAnonClient.mockReturnValue(fake);
  createUserScopedClient.mockReturnValue(fake);
  return fake;
}

describe('POST /api/projects (إنشاء)', () => {
  test('ينشئ مشروعًا برقم user_id من التوكن، عبر العميل المُقيَّد بالمستخدم', async () => {
    setupSupabase();

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer faketoken')
      .send({ projectName: 'مسار', currentStage: 'stage1', state: sampleState });

    expect(res.status).toBe(201);
    expect(createUserScopedClient).toHaveBeenCalledWith('faketoken');
  });

  test('يرفض بلا state (400)', async () => {
    setupSupabase();
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer faketoken')
      .send({ projectName: 'مسار' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id', () => {
  test('يُعيد 404 إن لم يُعثر على المشروع (بدل تسريب معلومة عن وجوده لمستخدم آخر)', async () => {
    setupSupabase({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) });

    const res = await request(app)
      .get('/api/projects/does-not-exist')
      .set('Authorization', 'Bearer faketoken');

    expect(res.status).toBe(404);
  });
});

describe('لا استخدام لـ Service Role في أي مسار طلبات عادي', () => {
  test('لا يوجد أي استخدام فعلي لمتغيّر SUPABASE_SERVICE_ROLE_KEY في كود المسارات (تجاهل التعليقات)', () => {
    const fs = require('fs');
    const path = require('path');
    const routesDir = path.join(__dirname, '..', 'routes');
    const libDir = path.join(__dirname, '..', 'lib');

    const filesToCheck = [
      ...fs.readdirSync(routesDir).map(f => path.join(routesDir, f)),
      path.join(libDir, 'supabaseClient.js'),
      path.join(libDir, 'authMiddleware.js')
    ];

    filesToCheck.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      // إزالة أسطر التعليقات (// ...) قبل الفحص، لأن ذكر المصطلح في تعليق يشرح عدم استخدامه ليس استخدامًا فعليًا
      const codeOnly = content
        .split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n');
      expect(codeOnly).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE/i);
      expect(codeOnly).not.toMatch(/SERVICE_ROLE_KEY\s*=/i);
    });
  });
});
