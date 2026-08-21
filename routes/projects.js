const express = require('express');
const router = express.Router();

// كل هذه الـendpoints تفترض تمرير الطلب عبر authMiddleware مسبقًا (مُرفَق في server.js)
// req.supabase عميل مُقيَّد بهوية req.userId — RLS تمنع أي تسريب بين المستخدمين
// حتى لو نسينا فحصًا يدويًا؛ لا اعتماد على فحص user_id في كود التطبيق وحده.

// GET /api/projects — قائمة مشاريع المستخدم الحالي (بيانات الفهرس فقط، لا state الكامل)
router.get('/projects', async (req, res) => {
  const { data, error } = await req.supabase
    .from('projects')
    .select('id, project_name, current_stage, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[GET /api/projects]', error);
    return res.status(500).json({ error: 'تعذّر جلب قائمة المشاريع.' });
  }

  return res.json({ projects: data });
});

// GET /api/projects/:id — بيانات مشروع واحد كاملة (form + state)
router.get('/projects/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'لم يُعثر على هذا المشروع، أو لا تملك صلاحية الوصول إليه.' });
  }

  return res.json({ project: data });
});

// POST /api/projects — إنشاء مشروع جديد
// المدخل: { projectName, currentStage, state }  (state = نفس بنية buildProjectData في v0.1)
router.post('/projects', async (req, res) => {
  const { projectName, currentStage, state } = req.body || {};

  if (!projectName || !state) {
    return res.status(400).json({ error: 'بيانات المشروع ناقصة — يلزم اسم المشروع وحالته.' });
  }

  const { data, error } = await req.supabase
    .from('projects')
    .insert({
      user_id: req.userId,
      project_name: projectName,
      current_stage: currentStage || null,
      state
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/projects]', error);
    return res.status(500).json({ error: 'تعذّر إنشاء المشروع: ' + error.message });
  }

  return res.status(201).json({ project: data });
});

// PUT /api/projects/:id — تحديث مشروع قائم (حفظ التقدم)
router.put('/projects/:id', async (req, res) => {
  const { projectName, currentStage, state } = req.body || {};

  if (!projectName || !state) {
    return res.status(400).json({ error: 'بيانات المشروع ناقصة — يلزم اسم المشروع وحالته.' });
  }

  const { data, error } = await req.supabase
    .from('projects')
    .update({
      project_name: projectName,
      current_stage: currentStage || null,
      state
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'تعذّر تحديث المشروع — قد لا يكون موجودًا أو لا تملك صلاحية تعديله.' });
  }

  return res.json({ project: data });
});

// POST /api/projects/:id/unlock — استهلاك رصيد واحد وفتح المشروع المدفوع
router.post('/projects/:id/unlock', async (req, res) => {
  try {
    const { data, error } = await req.supabase.rpc(
      'unlock_project_with_credit',
      { p_project_id: req.params.id }
    );

    if (error) {
      console.error('unlock_project_with_credit error:', error);
      return res.status(500).json({ error: 'تعذّر فتح المشروع.' });
    }

    if (data === 'no_credits') {
      return res.status(402).json({
        status: 'no_credits',
        error: 'لا يوجد رصيد مشاريع كافٍ.'
      });
    }

    if (data === 'project_not_found') {
      return res.status(404).json({
        status: 'project_not_found',
        error: 'المشروع غير موجود.'
      });
    }

    return res.json({ status: data });
  } catch (err) {
    console.error('unlock project error:', err);
    return res.status(500).json({ error: 'تعذّر فتح المشروع.' });
  }
});

module.exports = router;
