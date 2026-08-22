async function requirePaidProject(req, res, next) {
  try {
    const { projectId } = req.body || {};

    if (!projectId) {
      return res.status(400).json({
        error: 'معرّف المشروع مطلوب.'
      });
    }

    const { data: project, error } = await req.supabase
      .from('projects')
      .select('id, paid_unlocked')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({
        error: 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.'
      });
    }

    if (project.paid_unlocked !== true) {
      return res.status(403).json({
        error: 'هذا المشروع غير مفتوح للمراحل المدفوعة.'
      });
    }

    next();

  } catch (err) {
    console.error('[requirePaidProject]', err);

    return res.status(500).json({
      error: 'تعذّر التحقق من صلاحية المشروع.'
    });
  }
}

module.exports = { requirePaidProject };
