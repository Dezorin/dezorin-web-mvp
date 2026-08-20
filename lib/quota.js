// تتبّع استهلاك AI لكل مستخدم (بند 7 من الخطة).
// هذا حد أمان مرتفع فقط لمنع إساءة استخدام أو خطأ برمجي يُنتج حلقة استدعاءات
// لا نهائية — وليس نظام Quota تجاري أو خطة اشتراك. لا فوترة، لا مستويات
// استخدام، لا تمييز بين المستخدمين. حد واحد بسيط وموحّد للجميع.

function getDailySafetyLimit() {
  return parseInt(process.env.DAILY_AI_SAFETY_LIMIT || '500', 10);
}

/**
 * يتحقق هل تجاوز المستخدم حد الأمان اليومي، بلا تسجيل أي شيء.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - عميل مُقيَّد بهوية المستخدم
 * @param {string} userId
 * @returns {Promise<{allowed: boolean, count: number, limit: number}>}
 */
async function checkQuota(supabase, userId) {
  const since = new Date();
  since.setHours(0, 0, 0, 0); // بداية اليوم الحالي (بتوقيت الخادم)

  const { count, error } = await supabase
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  if (error) {
    console.error('[quota] فشل فحص الاستهلاك:', error);
    // فشل الفحص نفسه لا يجب أن يمنع الاستخدام العادي — هذا حد أمان، لا بوابة تجارية صارمة.
    return { allowed: true, count: 0, limit: getDailySafetyLimit() };
  }

  return {
    allowed: (count || 0) < getDailySafetyLimit(),
    count: count || 0,
    limit: getDailySafetyLimit()
  };
}

/**
 * يسجّل استدعاء AI ناجحًا واحدًا فور حدوثه — لا بعد انتهاء المرحلة كاملة،
 * حتى يبقى التسجيل دقيقًا لو فشلت المرحلة في منتصفها.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} stage - اسم المرحلة، مثل 'exploration' أو 'execution-idea'
 */
async function recordUsage(supabase, userId, stage) {
  const { error } = await supabase
    .from('ai_usage_events')
    .insert({ user_id: userId, stage });

  if (error) {
    // تسجيل الاستهلاك لا يجب أن يُسقط الطلب الأساسي إن فشل هو نفسه
    console.error('[quota] فشل تسجيل استهلاك AI:', error);
  }
}

/**
 * وسيط Express: يرفض الطلب قبل أي استدعاء OpenAI فعلي إن تجاوز المستخدم حد الأمان.
 */
async function quotaMiddleware(req, res, next) {
  const { allowed, count, limit } = await checkQuota(req.supabase, req.userId);

  if (!allowed) {
    return res.status(429).json({
      error: `تم بلوغ حد الأمان اليومي لاستدعاءات AI (${limit}). حاول لاحقًا أو تواصل مع فريق Dezorin.`,
      count,
      limit
    });
  }

  next();
}

module.exports = { checkQuota, recordUsage, quotaMiddleware, getDailySafetyLimit };
