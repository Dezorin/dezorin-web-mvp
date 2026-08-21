const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// حماية جميع وظائف الإدارة
function requireAdmin(req, res, next) {
  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId || req.userId !== adminUserId) {
    return res.status(403).json({ error: 'غير مصرح لك باستخدام وظائف الإدارة.' });
  }

  next();
}

// POST /api/admin/credits
// إضافة رصيد مشاريع إلى مستخدم عن طريق البريد الإلكتروني
router.post('/admin/credits', requireAdmin, async (req, res) => {
  try {
    const { email, credits } = req.body || {};

    const amount = Number(credits);

    if (
      !email ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: 'أدخل بريدًا صحيحًا وعدد مشاريع أكبر من صفر.'
      });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // البحث عن المستخدم بالبريد
    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      throw usersError;
    }

    const user = usersData.users.find(
      (u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(404).json({
        error: 'لا يوجد مستخدم مسجل بهذا البريد.'
      });
    }

    // قراءة الرصيد الحالي
    const { data: creditRow, error: creditError } =
      await supabaseAdmin
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single();

    if (creditError) {
      throw creditError;
    }

    const currentCredits = Number(creditRow.credits) || 0;
    const newCredits = currentCredits + amount;

    // إضافة الرصيد، وليس استبداله
    const { error: updateError } =
      await supabaseAdmin
        .from('user_credits')
        .update({ credits: newCredits })
        .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({
      success: true,
      email: user.email,
      added: amount,
      credits: newCredits
    });

  } catch (err) {
    console.error('[admin credits]', err);
    return res.status(500).json({
      error: 'تعذّرت إضافة الرصيد.'
    });
  }
});

module.exports = router;
