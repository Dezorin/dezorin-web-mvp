// طبقة الاتصال بـ Backend — الاستبدال الوحيد المطلوب لكل استدعاء OpenAI المباشر في v0.1.
// لا يوجد هنا أي نص Prompt ولا أي مفتاح API — فقط تمرير بيانات ونتائج.

const API_BASE = window.DEZORIN_API_BASE || '/api';

async function apiRequest(path, method, body) {
  const session = await getCurrentSession(); // من auth.js
  if (!session) {
    throw new Error('الجلسة غير صالحة — أعد تسجيل الدخول.');
  }

  const response = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `فشل الطلب (${response.status})`);
  }

  return data;
}

const Api = {
  decision: (payload) => apiRequest('/decision', 'POST', payload),
  stage1: (payload) => apiRequest('/stage1', 'POST', payload),
  stage2: (payload) => apiRequest('/stage2', 'POST', payload),
  explore: (payload) => apiRequest('/explore', 'POST', payload),
  discover: (payload) => apiRequest('/discover', 'POST', payload),
  approve: (payload) => apiRequest('/approve', 'POST', payload),

  listProjects: () => apiRequest('/projects', 'GET'),
  getProject: (id) => apiRequest(`/projects/${id}`, 'GET'),
  createProject: (payload) => apiRequest('/projects', 'POST', payload),
  updateProject: (id, payload) => apiRequest(`/projects/${id}`, 'PUT', payload),
  unlockProject: (id) => apiRequest(`/projects/${id}/unlock`, 'POST'),
};

