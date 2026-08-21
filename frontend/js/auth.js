// مصادقة المستخدم عبر Supabase Auth (جانب العميل).
// إضافة جديدة بالكامل عن v0.1 — لا يوجد أي مفهوم "مستخدم" في النسخة المحلية.
// مطلوب: تضمين مكتبة supabase-js عبر CDN في index.html قبل هذا الملف.
//
// SUPABASE_URL وSUPABASE_ANON_KEY لا تُكتبان هنا ولا في index.html — تُجلَبان من
// /api/config (endpoint عام بلا Auth، يقرأهما من backend/.env). هذا يعني: إعداد
// Supabase يتم في مكان واحد فقط (.env على الخادم)، بلا أي تعديل لكود الواجهة.

let supabaseAuthClient = null;

// يجب استدعاء هذه الدالة وانتظارها مرة واحدة قبل أي استخدام آخر لهذا الملف (main.js يفعل ذلك أولًا).
async function initAuth() {
  const response = await fetch((window.DEZORIN_API_BASE || '/api') + '/config');
  if (!response.ok) {
    throw new Error('تعذّر جلب إعدادات الاتصال من الخادم — تأكد أن الخادم يعمل.');
  }
  const { supabaseUrl, supabaseAnonKey } = await response.json();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعدادات Supabase غير مضبوطة على الخادم — راجع backend/.env (SUPABASE_URL وSUPABASE_ANON_KEY).');
  }

  supabaseAuthClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
}

async function getCurrentSession() {
  const { data, error } = await supabaseAuthClient.auth.getSession();
  if (error || !data.session) return null;
  return data.session;
}

async function signInWithPassword(email, password) {
  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

async function signUpWithPassword(email, password) {
  const { data, error } = await supabaseAuthClient.auth.signUp({
    email,
    password
  });

  if (error) throw new Error(error.message);
  return data;
}

async function signOut() {
  await supabaseAuthClient.auth.signOut();
}

function onAuthStateChange(callback) {
  supabaseAuthClient.auth.onAuthStateChange((_event, session) => callback(session));
}
