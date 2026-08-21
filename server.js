require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authMiddleware = require('./lib/authMiddleware');

const decisionRoute = require('./routes/decision');
const stage1Route = require('./routes/stage1');
const stage2Route = require('./routes/stage2');
const exploreRoute = require('./routes/explore');
const discoverRoute = require('./routes/discover');
const approveRoute = require('./routes/approve');
const projectsRoute = require('./routes/projects');
const adminRoute = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// فحص صحة بسيط — بلا Auth، لا يكشف أي شيء حساس
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'dezorin-web-mvp-0.1' });
});

// إعدادات عامة للواجهة — بلا Auth، بلا أي سر.
// SUPABASE_ANON_KEY مصمَّم أصلًا ليكون عامًا (يظهر لأي مستخدم في متصفحه بطبيعته)؛
// هذا الـ endpoint يزيل حاجة تعديل frontend/index.html يدويًا — القيمتان تُقرآن
// من backend/.env فقط، مصدر الحقيقة الوحيد. لا يُقرأ أو يُعاد SERVICE_ROLE_KEY هنا
// أو في أي مكان آخر من الكود.
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null
  });
});

// كل ما بعد هذا السطر يتطلب هوية مستخدم مُصادَق
app.use('/api', authMiddleware);

app.use('/api', decisionRoute);
app.use('/api', stage1Route);
app.use('/api', stage2Route);
app.use('/api', exploreRoute);
app.use('/api', discoverRoute);
app.use('/api', approveRoute);
app.use('/api', projectsRoute);
app.use('/api', adminRoute);

// معالج أخطاء عام أخير — يمنع تسريب تفاصيل داخلية (مسارات ملفات، stack traces) للعميل
app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم.' });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Dezorin Web Backend يعمل على المنفذ ${PORT}`);
  });
}

module.exports = app; // للاختبارات (supertest)
