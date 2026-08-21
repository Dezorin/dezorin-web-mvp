// نقطة التشغيل — إدارة عرض شاشة الدخول مقابل التطبيق، بناءً على جلسة Supabase.
// إضافة جديدة بالكامل عن v0.1 (لا يوجد مفهوم جلسة/مستخدم في النسخة المحلية).

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!email || !password) {
    errorBox.textContent = 'أدخل البريد الإلكتروني وكلمة المرور.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;
  try {
    await signInWithPassword(email, password);
    // onAuthStateChange (مُسجَّل أدناه) سيتولى إظهار التطبيق تلقائيًا
  } catch (err) {
   errorBox.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
  }
}
async function handleSignup() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('loginError');
  const btn = document.getElementById('signupBtn');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!email || !password) {
    errorBox.textContent = 'أدخل البريد الإلكتروني وكلمة المرور.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;

  try {
    const data = await signUpWithPassword(email, password);

    if (data.session) {
      // إذا كان تأكيد البريد غير مطلوب، سيدخل المستخدم تلقائيًا.
      return;
    }

    errorBox.textContent = 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول.';
    errorBox.style.color = 'var(--ok, #1a7f37)';
    errorBox.classList.add('active');
  } catch (err) {
    errorBox.style.color = '';
    errorBox.textContent = 'تعذّر إنشاء الحساب: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
  }
}

async function handleLogout() {
  await signOut();
  // إعادة تحميل الصفحة أبسط وأضمن طريقة لمسح كل حالة window.__ الخاصة بالمستخدم السابق
  window.location.reload();
}

function showApp() {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
}

function showLogin() {
  document.getElementById('loginCard').style.display = 'block';
  document.getElementById('appRoot').style.display = 'none';
}

(async function bootstrap() {
  try {
    await initAuth(); // يجلب SUPABASE_URL/ANON_KEY من /api/config وينشئ العميل
  } catch (err) {
    console.error(err);
    const errorBox = document.getElementById('loginError');
    errorBox.textContent = err.message;
    errorBox.classList.add('active');
    document.getElementById('loginBtn').disabled = true;
    showLogin();
    return; // لا فائدة من المتابعة بلا عميل Supabase صالح
  }

  const session = await getCurrentSession();
  if (session) {
    showApp();
  } else {
    showLogin();
  }

  onAuthStateChange((session) => {
    if (session) {
      showApp();
    } else {
      showLogin();
    }
  });
})();
