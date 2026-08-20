// نسخة خادمية من callOpenAI في v0.1.
// منطق تفسير JSON (إزالة أسوار Markdown، اقتطاع بين أول/آخر قوس) منقول حرفيًا — لا تغيير.
// الإضافة الوحيدة عن v0.1: إعادة محاولة محدودة لأخطاء 429/5xx فقط (بند 9 من الاستشارة المعمارية:
// ضرورية الآن مع استخدام متزامن من عدة مستخدمين على نفس المفتاح؛ لم تكن ضرورية لمستخدم واحد محليًا).

const MODEL = 'gpt-4o';
const MAX_RETRIES = 2; // أي حتى 3 محاولات إجمالية
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * @param {string} apiKey - مفتاح OpenAI (من متغيرات بيئة الخادم فقط، لا يصل أبدًا للعميل)
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<object>} الكائن المُفسَّر من رد JSON
 */
async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error ? errData.error.message : ('رمز الخطأ: ' + response.status);

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = new Error('فشل الاتصال بـ OpenAI: ' + msg);
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw new Error('فشل الاتصال بـ OpenAI: ' + msg);
      }

      const data = await response.json();
      // ==== منطق تفسير الرد — منقول حرفيًا من v0.1، بلا أي تغيير ====
      let raw = data.choices[0].message.content.trim();
      raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('لم يحتوِ الرد على JSON صالح.');
      }
      raw = raw.slice(firstBrace, lastBrace + 1);
      return JSON.parse(raw);

    } catch (err) {
      // أخطاء الشبكة (fetch نفسه فشل) قابلة لإعادة المحاولة أيضًا
      if (err.name === 'TypeError' && attempt < MAX_RETRIES) {
        lastError = err;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('فشل الاتصال بـ OpenAI بعد إعادة المحاولة.');
}

module.exports = { callOpenAI };
