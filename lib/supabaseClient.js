// عميل Supabase من جهة الخادم.
//
// قرار معماري مهم (مطابق لتوجيه صريح): لا نستخدم SUPABASE_SERVICE_ROLE_KEY
// في مسار معالجة طلبات المستخدمين العاديين، لأن مفتاح Service Role يتجاوز
// RLS بالكامل — استخدامه هنا يجعل RLS شكليًا لا فعليًا، وهذا مرفوض صراحة.
//
// بدلًا من ذلك: لكل طلب وارد من مستخدم مُصادَق، نُنشئ عميل Supabase جديدًا
// باستخدام مفتاح anon العام + توكن JWT الخاص بهذا المستخدم تحديدًا (مُمرَّر
// في رأس Authorization). هذا يجعل PostgREST يُقيّم auth.uid() فعليًا كهوية
// ذلك المستخدم عند تنفيذ أي استعلام، فتُطبَّق سياسات RLS بصرامة من قاعدة
// البيانات نفسها — لا من كود التطبيق فقط.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabaseClient] SUPABASE_URL أو SUPABASE_ANON_KEY غير مضبوطين في متغيرات البيئة.');
}

/**
 * ينشئ عميل Supabase مُقيَّدًا بهوية مستخدم واحد فقط عبر توكن الجلسة الخاص به.
 * كل استعلام عبر هذا العميل يخضع لسياسات RLS كأنه صادر من ذلك المستخدم تحديدًا.
 *
 * @param {string} userJwt - توكن الوصول (access_token) الصادر من Supabase Auth للمستخدم
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createUserScopedClient(userJwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * عميل عام (anon) بلا هوية مستخدم — يُستخدَم فقط للتحقق من صحة توكن الدخول
 * نفسه (auth.getUser)، لا لأي استعلام بيانات.
 */
function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = { createUserScopedClient, createAnonClient };
