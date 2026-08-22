const express = require('express');
const router = express.Router();

const { callOpenAI } = require('../lib/openaiClient');
const { quotaMiddleware, recordUsage } = require('../lib/quota');
const { requirePaidProject } = require('../lib/requirePaidProject');
const { EXPLORATION_SYSTEM_PROMPT, EXPLORATION_JUDGE_SYSTEM_PROMPT } = require('../prompts/exploration');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST /api/explore
// المدخل: { projectId, breakdown: string[] }
// المخرج: { candidates_generated: number, qualified_relations: [{id, elements_used, what_emerged}] }
router.post('/explore', quotaMiddleware, requirePaidProject, async (req, res) => {
  const { projectId, breakdown } = req.body || {};

  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return res.status(400).json({
      error: 'نفّذ مرحلة التفكيك أولًا — لا وحدات متاحة للاستكشاف.'
    });
  }

  const userPrompt = `وحدات التفكيك المعتمدة:
${breakdown.map((x, i) => `${i + 1}. ${x}`).join('\n')}

ابحث عن كل العلاقات الصحيحة الممكنة وفق التعليمات، وأعد النتيجة بصيغة JSON المحددة فقط.`;

  try {
    // ==== الاستدعاء الأول: المولّد ====
    const genData = await callOpenAI(
      OPENAI_API_KEY,
      EXPLORATION_SYSTEM_PROMPT,
      userPrompt
    );

    await recordUsage(req.supabase, req.userId, 'exploration');

    const candidates = Array.isArray(genData.candidate_relations)
      ? genData.candidate_relations
      : [];

    let qualifiedRelations = [];

    // ==== الاستدعاء الثاني: الحَكَم — كل مرشح في استدعاء منفصل ومعزول ====
    for (const c of candidates) {
      const judgeUserPrompt = `المرشح للتحقق:
العناصر المستخدمة: ${JSON.stringify(c.elements_used)}
what_emerged: "${c.what_emerged}"

راجع هذا المرشح وفق الحكمين المحددين، وأعد النتيجة بصيغة JSON المحددة فقط.`;

      const judgeData = await callOpenAI(
        OPENAI_API_KEY,
        EXPLORATION_JUDGE_SYSTEM_PROMPT,
        judgeUserPrompt
      );

      await recordUsage(req.supabase, req.userId, 'exploration');

      const verdicts = Array.isArray(judgeData.verdicts)
        ? judgeData.verdicts
        : [];

      const v = verdicts[0];

      if (
        v &&
        v.traceable_to_material === true &&
        v.valid_inference === true
      ) {
        qualifiedRelations.push({
          id: qualifiedRelations.length,
          elements_used: c.elements_used,
          what_emerged: c.what_emerged
        });
      }
    }

    return res.json({
      candidates_generated: candidates.length,
      qualified_relations: qualifiedRelations
    });

  } catch (err) {
    console.error('[POST /api/explore]', err);

    return res.status(502).json({
      error: 'حدث خطأ أثناء الاستكشاف: ' + err.message
    });
  }
});

module.exports = router;
