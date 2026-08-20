const express = require('express');
const router = express.Router();

const { callOpenAI } = require('../lib/openaiClient');
const { quotaMiddleware, recordUsage } = require('../lib/quota');
const { STAGE2_SYSTEM_PROMPT } = require('../prompts/stage2');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST /api/stage2
// المدخل: { transferredMaterial: string[] }
// المخرج: { breakdown: [...], units_meta: [...], links: [...] }
router.post('/stage2', quotaMiddleware, async (req, res) => {
  const { transferredMaterial } = req.body || {};

  if (!Array.isArray(transferredMaterial) || transferredMaterial.length === 0) {
    return res.status(400).json({ error: 'نفّذ مرحلة التحليل أولًا — المادة المنقولة غير موجودة.' });
  }

  const userPrompt = `المادة المنقولة من مرحلة التحليل:
${transferredMaterial.map((x, i) => `${i + 1}. ${x}`).join('\n')}

فكك هذه المادة وفق التعليمات، وأعد النتيجة بصيغة JSON المحددة فقط.`;

  try {
    const data = await callOpenAI(OPENAI_API_KEY, STAGE2_SYSTEM_PROMPT, userPrompt);
    await recordUsage(req.supabase, req.userId, 'stage2');

    // توافق عكسي — نفس منطق v0.1 حرفيًا
    data.units_meta = Array.isArray(data.units_meta) ? data.units_meta : [];
    data.links = Array.isArray(data.links) ? data.links : [];

    return res.json(data);
  } catch (err) {
    console.error('[POST /api/stage2]', err);
    return res.status(502).json({ error: 'حدث خطأ أثناء التفكيك: ' + err.message });
  }
});

module.exports = router;
