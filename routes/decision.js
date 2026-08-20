const express = require('express');
const router = express.Router();

const { callOpenAI } = require('../lib/openaiClient');
const { quotaMiddleware, recordUsage } = require('../lib/quota');
const { SYSTEM_PROMPT, TIE_BREAK_SYSTEM_PROMPT } = require('../prompts/decision');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST /api/decision
// المدخل: { projName, projField, projProduct, q1, q2, q3, q4 }
// المخرج: نفس بنية "parsed" التي كان يبنيها runEngine في v0.1 (candidates + totals + starting_point ...)
router.post('/decision', quotaMiddleware, async (req, res) => {
  const { projName, projField, projProduct, q1, q2, q3, q4 } = req.body || {};

  if (!projName || !q1 || !q2 || !q3 || !q4) {
    return res.status(400).json({ error: 'يرجى تعبئة اسم المشروع وكل الأسئلة الأربعة قبل التحليل.' });
  }

  const userPrompt = `اسم المشروع: ${projName}
مجال النشاط: ${projField || 'غير محدد'}
المنتج/الخدمة: ${projProduct || 'غير محدد'}

إجابات العميل:
1. وصف المشروع: ${q1}
2. قصة الاسم: ${q2}
3. ما يميّز المنتج: ${q3}
4. سبب بدء المشروع: ${q4}

طبّق دليل اتخاذ قرار البداية على هذه البيانات فقط، وأعد النتيجة بصيغة JSON المحددة في التعليمات، بلا أي نص إضافي خارج الكائن.`;

  try {
    const parsed = await callOpenAI(OPENAI_API_KEY, SYSTEM_PROMPT, userPrompt);
    await recordUsage(req.supabase, req.userId, 'decision');

    if (!parsed.candidates) {
      return res.status(502).json({ error: 'الرد لا يحتوي بنية النتائج المتوقعة (candidates).' });
    }

    // ==== نفس الحساب الحسابي حرفيًا من v0.1: المجموع، الفائز، عتبة الحد الأدنى، اكتشاف التعادل ====
    const order = ['name', 'letter', 'product', 'value'];
    order.forEach(k => {
      const c = parsed.candidates[k];
      c.total = c.conditions.reduce((sum, cond) => sum + Number(cond.score), 0);
    });

    let maxTotal = -1;
    order.forEach(k => { if (parsed.candidates[k].total > maxTotal) maxTotal = parsed.candidates[k].total; });

    const topKeys = order.filter(k => parsed.candidates[k].total === maxTotal);

    if (maxTotal < 4) {
      parsed.insufficient_result = true;
      parsed.starting_point = null;
      parsed.tie_break_applied = false;
      parsed.tie_break_reason = null;
    } else if (topKeys.length === 1) {
      parsed.insufficient_result = false;
      parsed.starting_point = topKeys[0];
      parsed.tie_break_applied = false;
      parsed.tie_break_reason = null;
    } else {
      // تعادل حقيقي — استدعاء ثانٍ مصغّر لكسر التعادل فقط
      const tieUserPrompt = `بيانات العميل الأصلية:
اسم المشروع: ${projName}
مجال النشاط: ${projField || 'غير محدد'}
المنتج/الخدمة: ${projProduct || 'غير محدد'}
1. وصف المشروع: ${q1}
2. قصة الاسم: ${q2}
3. ما يميّز المنتج: ${q3}
4. سبب بدء المشروع: ${q4}

النقطتان المتعادلتان (المجموع لكل منهما: ${maxTotal} من 6):
${topKeys.map(k => {
    const c = parsed.candidates[k];
    const evLines = c.conditions.map(cond => `  - ${cond.id}: evidence="${cond.evidence}" — score=${cond.score}`).join('\n');
    return `"${k}" (${c.label}):\n${evLines}`;
  }).join('\n\n')}

طبّق قاعدة كسر التعادل الرسمية، واحكم أي مفتاح ("${topKeys.join('" أو "')}") يفوز.`;

      const tieParsed = await callOpenAI(OPENAI_API_KEY, TIE_BREAK_SYSTEM_PROMPT, tieUserPrompt);
      await recordUsage(req.supabase, req.userId, 'decision');

      parsed.insufficient_result = false;
      parsed.starting_point = tieParsed.winner;
      parsed.tie_break_applied = true;
      parsed.tie_break_reason = tieParsed.tie_break_reason;
    }

    return res.json(parsed);

  } catch (err) {
    console.error('[POST /api/decision]', err);
    return res.status(502).json({ error: 'حدث خطأ أثناء التحليل: ' + err.message });
  }
});

module.exports = router;
