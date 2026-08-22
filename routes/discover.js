const express = require('express');
const router = express.Router();

const { callOpenAI } = require('../lib/openaiClient');
const { quotaMiddleware, recordUsage } = require('../lib/quota');
const { requirePaidProject } = require('../lib/requirePaidProject');
const { DISCOVERY_GEN_SYSTEM_PROMPT, DISCOVERY_JUDGE_SYSTEM_PROMPT } = require('../prompts/discovery');
const { EXECUTION_IDEA_GEN_SYSTEM_PROMPT, EXECUTION_IDEA_JUDGE_SYSTEM_PROMPT } = require('../prompts/executionIdea');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_EXECUTION_ATTEMPTS = 3;

// POST /api/discover
// المدخل: { projectId, qualifiedRelations: [{id, elements_used, what_emerged}], transferredMaterial: string[] }
// المخرج: { qualifiedDirections: [...], pendingDiscoveries: [...] }
//
// ملاحظة معمارية (يُبلَّغ عنها في تقرير الاختلافات):
// في خطة الترحيل المعتمدة كانت discover.js وexecutionIdea.js مذكورتين كملفين منفصلين
// في بنية الملفات، لكن v0.1 لا تملك زرًا مستقلًا لإعادة محاولة فكرة التنفيذ بمعزل عن
// الاكتشاف — زر "بدء الاكتشاف" الواحد ينفّذ الاثنين معًا ذريًا (runDiscoveryAndBridge).
// للحفاظ على مطابقة سلوك v0.1 حرفيًا (لا توسيع ولا تغيير في تجربة الاستخدام)، هذا الـ
// endpoint الواحد يكرر منطق الدالتين معًا كما في v0.1، وملف executionIdea.js بقي
// كملف Prompts فقط (مُستخدَم هنا)، لا كـ endpoint HTTP مستقل.
router.post('/discover', requirePaidProject, quotaMiddleware, async (req, res) => {
  const { projectId, qualifiedRelations, transferredMaterial } = req.body || {};

  if (!Array.isArray(qualifiedRelations) || qualifiedRelations.length === 0) {
    return res.status(400).json({
      error: 'لا توجد علاقات مؤهلة من الاستكشاف للانتقال منها للاكتشاف.'
    });
  }

  const originalMaterial =
    Array.isArray(transferredMaterial) && transferredMaterial.length > 0
      ? transferredMaterial.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : 'غير متوفرة';

  try {
    // ==== مولّد الاكتشاف — استدعاء واحد يستقبل كل العلاقات المؤهلة معًا ====
    const discGenPrompt = `العلاقات المؤهلة من الاستكشاف (بمعرّفاتها):
${qualifiedRelations.map(r => `${r.id}. العناصر: ${JSON.stringify(r.elements_used)} — what_emerged: ${r.what_emerged}`).join('\n')}

المادة الخام الكاملة للمشروع:
${originalMaterial}

راجع كل العلاقات المؤهلة مجتمعة وأنتج الاكتشاف/الاكتشافات وفق التعليمات، وأعد النتيجة بصيغة JSON المحددة فقط.`;

    const discGenData = await callOpenAI(
      OPENAI_API_KEY,
      DISCOVERY_GEN_SYSTEM_PROMPT,
      discGenPrompt
    );

    await recordUsage(req.supabase, req.userId, 'discovery');

    const rawDiscoveries = Array.isArray(discGenData.discoveries)
      ? discGenData.discoveries
      : [];

    const relationsById = {};
    qualifiedRelations.forEach(r => {
      relationsById[r.id] = r;
    });

    const passedDiscoveries = [];

    // ==== حَكَم الاكتشاف — كل اكتشاف بمعزل عن الباقي ====
    for (const disc of rawDiscoveries) {
      if (!disc.discovery_text) continue;

      const sourceIds = Array.isArray(disc.source_relation_ids)
        ? disc.source_relation_ids
        : [];

      const sourceRelationsText = sourceIds
        .map(id => relationsById[id])
        .filter(Boolean)
        .map(r => `العناصر: ${JSON.stringify(r.elements_used)} — what_emerged: ${r.what_emerged}`)
        .join('\n');

      if (!sourceRelationsText) continue;

      const discJudgePrompt = `discovery_text المُقترَح: ${disc.discovery_text}

العلاقة/العلاقات المؤهلة التي استند إليها:
${sourceRelationsText}

المادة الخام الكاملة للمشروع:
${originalMaterial}

راجع وفق الأسئلة الأربعة، وأعد النتيجة بصيغة JSON المحددة فقط.`;

      const discJudge = await callOpenAI(
        OPENAI_API_KEY,
        DISCOVERY_JUDGE_SYSTEM_PROMPT,
        discJudgePrompt
      );

      await recordUsage(req.supabase, req.userId, 'discovery');

      const discPass =
        discJudge.traceable_to_material === true &&
        discJudge.derived_not_restated === true &&
        discJudge.project_specific === true &&
        discJudge.principle_not_product === true;

      if (!discPass) continue;

      passedDiscoveries.push({
        discovery_text: disc.discovery_text,
        source_relation_ids: sourceIds
      });
    }

    const qualifiedDirections = [];
    const pendingDiscoveries = [];

    for (const disc of passedDiscoveries) {
      const sourceRelationsText = disc.source_relation_ids
        .map(id => relationsById[id])
        .filter(Boolean)
        .map(r => `العناصر: ${JSON.stringify(r.elements_used)} — what_emerged: ${r.what_emerged}`)
        .join('\n');

      const rejectedAttempts = [];
      let resolved = false;

      for (
        let attempt = 1;
        attempt <= MAX_EXECUTION_ATTEMPTS && !resolved;
        attempt++
      ) {
        const rejectedBlock =
          rejectedAttempts.length > 0
            ? `\nمحاولات سابقة رُفضت لهذا الاكتشاف — اشتق فكرة مختلفة فعليًا عنها:\n${rejectedAttempts.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
            : '';

        const ideaGenPrompt = `discovery_text: ${disc.discovery_text}

العلاقة/العلاقات المصدر:
${sourceRelationsText}

المادة الخام الكاملة للمشروع:
${originalMaterial}
${rejectedBlock}
اشتق فكرة تنفيذ شعار وفق التعليمات، وأعد النتيجة بصيغة JSON المحددة فقط.`;

        const ideaGenData = await callOpenAI(
          OPENAI_API_KEY,
          EXECUTION_IDEA_GEN_SYSTEM_PROMPT,
          ideaGenPrompt
        );

        await recordUsage(
          req.supabase,
          req.userId,
          'execution-idea'
        );

        if (!ideaGenData.execution_idea) {
          continue;
        }

        const ideaJudgePrompt = `discovery_text: ${disc.discovery_text}

العلاقة/العلاقات المصدر:
${sourceRelationsText}

المادة الخام الكاملة للمشروع:
${originalMaterial}

execution_idea المُقترَحة: ${ideaGenData.execution_idea}
derivation_trace: ${ideaGenData.derivation_trace}

راجع وفق السؤال المحدد، وأعد النتيجة بصيغة JSON المحددة فقط.`;

        const ideaJudge = await callOpenAI(
          OPENAI_API_KEY,
          EXECUTION_IDEA_JUDGE_SYSTEM_PROMPT,
          ideaJudgePrompt
        );

        await recordUsage(
          req.supabase,
          req.userId,
          'execution-idea'
        );

        if (ideaJudge.execution_idea_valid === true) {
          qualifiedDirections.push({
            source: disc.source_relation_ids.join(','),
            discovery_text: disc.discovery_text,
            execution_point: ideaGenData.execution_idea,
            selection_reason: ideaGenData.derivation_trace
          });

          resolved = true;
        } else {
          rejectedAttempts.push(ideaGenData.execution_idea);
        }
      }

      if (!resolved) {
        pendingDiscoveries.push({
          discovery_text: disc.discovery_text,
          source: disc.source_relation_ids.join(',')
        });
      }
    }

    return res.json({
      qualifiedDirections,
      pendingDiscoveries
    });

  } catch (err) {
    console.error('[POST /api/discover]', err);

    return res.status(502).json({
      error: 'حدث خطأ أثناء الاكتشاف/فكرة تنفيذ الشعار: ' + err.message
    });
  }
});

module.exports = router;
