const express = require('express');
const router = express.Router();

const { callOpenAI } = require('../lib/openaiClient');
const { quotaMiddleware, recordUsage } = require('../lib/quota');
const { STAGE1_SYSTEM_PROMPT } = require('../prompts/stage1');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST /api/stage1
// المدخل: { winnerLabel, q1, q2, q3, q4 }
// المخرج: { transferred_material: [...] }
router.post('/stage1', quotaMiddleware, async (req, res) => {
  const { winnerLabel, q1, q2, q3, q4 } = req.body || {};

  if (!winnerLabel || !q1 || !q2 || !q3 || !q4) {
    return res.status(400).json({ error: 'بيانات ناقصة — يلزم نقطة البداية المعتمدة وكل الأسئلة الأربعة.' });
  }

  const userPrompt = `نقطة البداية المعتمدة: ${winnerLabel}

إجابات العميل الكاملة كما أدخلها المستخدم:
1. وصف المشروع: ${q1}
2. قصة الاسم: ${q2}
3. ما يميّز المنتج: ${q3}
4. سبب بدء المشروع: ${q4}

حدد المادة المرتبطة بنقطة البداية "${winnerLabel}" فقط، وأعدها بصيغة JSON المحددة.`;

  try {
    const data = await callOpenAI(OPENAI_API_KEY, STAGE1_SYSTEM_PROMPT, userPrompt);
    await recordUsage(req.supabase, req.userId, 'stage1');
    return res.json(data);
  } catch (err) {
    console.error('[POST /api/stage1]', err);
    return res.status(502).json({ error: 'حدث خطأ أثناء التحليل: ' + err.message });
  }
});

module.exports = router;
