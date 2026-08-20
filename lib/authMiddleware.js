// وسيط التحقق من الهوية — إلزامي على كل endpoint يمس بيانات مستخدم أو يستدعي AI.
// يستخرج توكن Supabase من رأس Authorization، يتحقق من صحته، ثم يُرفق:
//   req.userId          — هوية المستخدم (uuid)
//   req.userJwt          — التوكن نفسه (يُستخدَم لاحقًا لبناء عميل Supabase مُقيَّد بهويته)
//   req.supabase         — عميل Supabase مُقيَّد بهوية هذا المستخدم فقط (RLS فعّالة)

const { createAnonClient, createUserScopedClient } = require('./supabaseClient');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'مطلوب تسجيل الدخول — لا يوجد توكن مصادقة.' });
  }

  try {
    const anonClient = createAnonClient();
    const { data, error } = await anonClient.auth.getUser(token);

    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو منتهية — أعد تسجيل الدخول.' });
    }

    req.userId = data.user.id;
    req.userJwt = token;
    req.supabase = createUserScopedClient(token);

    next();
  } catch (err) {
    console.error('[authMiddleware]', err);
    return res.status(500).json({ error: 'تعذّر التحقق من هوية المستخدم.' });
  }
}

module.exports = authMiddleware;
