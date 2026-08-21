// إدارة المشاريع — نفس شكل البيانات ومنطق الاستعادة من v0.1 حرفيًا (buildProjectData/
// restoreUIFromState)، لكن الوجهة الآن Backend (وبالتالي Supabase) بدل localStorage.
// لا يوجد هنا استيراد/تصدير JSON محلي في هذا الإصدار الأول من MVP (اختلاف مسجَّل في
// تقرير الترحيل) — الحفظ/الفتح عبر الحساب هو المسار الوحيد الآن.

function buildProjectStateBlob() {
  return {
    form: {
      projName: document.getElementById('projName').value,
      projField: document.getElementById('projField').value,
      projProduct: document.getElementById('projProduct').value,
      q1: document.getElementById('q1').value,
      q2: document.getElementById('q2').value,
      q3: document.getElementById('q3').value,
      q4: document.getElementById('q4').value
    },
    state: {
      lastResult: window.__lastResult || null,
      lastProject: window.__lastProject || null,
      stage1Result: window.__stage1Result || null,
      stage2Result: window.__stage2Result || null,
      explorationResult: window.__explorationResult || null,
      discoveryResults: window.__discoveryResults || null,
      qualifiedDirections: window.__qualifiedDirections || null,
      pendingDiscoveries: window.__pendingDiscoveries || null,
      approvedDirections: window.__approvedDirections || null
    }
  };
}

async function saveProject() {
  const errorBox = document.getElementById('saveProjectError');
  errorBox.classList.remove('active');
  errorBox.textContent = '';
  errorBox.style.color = '';

  if (!window.__lastProject) {
    errorBox.textContent = 'لا يوجد مشروع نشط لحفظه بعد — نفّذ تحليل نقطة البداية أولًا.';
    errorBox.classList.add('active');
    return;
  }

  const payload = {
    projectName: window.__lastProject,
    currentStage: window.__currentStage || null,
    state: buildProjectStateBlob()
  };

  try {
    if (window.__currentProjectId) {
      await Api.updateProject(window.__currentProjectId, payload);
    } else {
      const { project } = await Api.createProject(payload);
      window.__currentProjectId = project.id;
    }

    errorBox.textContent = '✓ تم حفظ المشروع بنجاح.';
    errorBox.style.color = 'var(--ok, #1a7f37)';
    errorBox.classList.add('active');
    setTimeout(() => { errorBox.classList.remove('active'); errorBox.style.color = ''; }, 3000);

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'تعذّر حفظ المشروع: ' + err.message;
    errorBox.classList.add('active');
  }
}

async function showProjectList() {
  const panel = document.getElementById('projectListPanel');
  const box = document.getElementById('projectListResults');

  try {
    const { projects } = await Api.listProjects();

    if (!projects || projects.length === 0) {
      box.innerHTML = `<p style="font-size:13px; color:var(--muted);">لا توجد مشاريع محفوظة بعد.</p>`;
    } else {
      const STAGE_LABELS = {
        decision: 'قرار البداية', stage1: 'تحليل نقطة البداية', stage2: 'التفكيك',
        exploration: 'الاستكشاف', discovery: 'فكرة تنفيذ الشعار', approved: 'الاعتماد', report: 'تقرير العميل'
      };
      let html = '';
      projects.forEach(p => {
        const dateLabel = new Date(p.updated_at).toLocaleString('ar');
        const stageLabel = STAGE_LABELS[p.current_stage] || 'غير محدد';
        html += `<div style="border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-size:14px; font-weight:700;">${p.project_name}</div>
            <div style="font-size:12px; color:var(--muted);">آخر تحديث: ${dateLabel} — توقف عند: ${stageLabel}</div>
          </div>
          <button class="run-btn" style="width:auto; padding:8px 16px; flex-shrink:0;" onclick="openProject('${p.id}')">فتح</button>
        </div>`;
      });
      box.innerHTML = html;
    }

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error(err);
    box.innerHTML = `<p style="font-size:13px; color:#b91c1c;">تعذّر جلب المشاريع: ${err.message}</p>`;
    panel.style.display = 'block';
  }
}

function closeProjectList() {
  document.getElementById('projectListPanel').style.display = 'none';
}

async function openProject(id) {
  try {
    const { project } = await Api.getProject(id);
    const stateBlob = project.state; // { form, state }

    document.getElementById('projName').value = stateBlob.form.projName || '';
    document.getElementById('projField').value = stateBlob.form.projField || '';
    document.getElementById('projProduct').value = stateBlob.form.projProduct || '';
    document.getElementById('q1').value = stateBlob.form.q1 || '';
    document.getElementById('q2').value = stateBlob.form.q2 || '';
    document.getElementById('q3').value = stateBlob.form.q3 || '';
    document.getElementById('q4').value = stateBlob.form.q4 || '';

    window.__lastResult = stateBlob.state.lastResult;
    window.__lastProject = stateBlob.state.lastProject;
    window.__stage1Result = stateBlob.state.stage1Result;
    window.__stage2Result = stateBlob.state.stage2Result;
    window.__explorationResult = stateBlob.state.explorationResult;
    window.__discoveryResults = stateBlob.state.discoveryResults;
    window.__qualifiedDirections = stateBlob.state.qualifiedDirections;
    window.__pendingDiscoveries = stateBlob.state.pendingDiscoveries;
    window.__approvedDirections = stateBlob.state.approvedDirections;
    window.__currentStage = project.current_stage || null;
    window.__currentProjectId = project.id;

    closeProjectList();
    restoreUIFromState();

  } catch (err) {
    console.error(err);
    alert('تعذّر فتح المشروع: ' + err.message);
  }
}

// نفس منطق v0.1 حرفيًا — إعادة بناء الواجهة كاملة من الحالة المستعادة، بلا أي استدعاء AI
function restoreUIFromState() {
  document.getElementById('results').classList.remove('active');
  document.getElementById('methodCard').style.display = 'none';
  document.getElementById('stage1Results').style.display = 'none';
  document.getElementById('stage2Block').style.display = 'none';
  document.getElementById('stage2Results').style.display = 'none';
  document.getElementById('explorationBlock').style.display = 'none';
  document.getElementById('explorationResults').style.display = 'none';
  document.getElementById('discoveryBlock').style.display = 'none';
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';
  document.getElementById('reportResults').style.display = 'none';
  document.getElementById('printReportBtn').style.display = 'none';

  if (window.__lastResult) {
    renderResults(window.__lastResult);
  }

  if (window.__stage1Result) {
    const box = document.getElementById('stage1Results');
    box.innerHTML = `<h2 style="font-size:15px; margin:0 0 10px;">المادة المنقولة إلى التفكيك</h2>
      <ul style="margin:0; padding-right:20px; font-size:14px; color:var(--text);">
        ${window.__stage1Result.transferred_material.map(x => `<li style="margin-bottom:6px;">${x}</li>`).join('')}
      </ul>`;
    box.style.display = 'block';
    document.getElementById('stage2Block').style.display = 'block';
  }

  if (window.__stage2Result) {
    const box = document.getElementById('stage2Results');
    box.innerHTML = `<h2 style="font-size:15px; margin:0 0 10px;">نتيجة التفكيك</h2>
      <ul style="margin:0; padding-right:20px; font-size:14px; color:var(--text);">
        ${window.__stage2Result.breakdown.map(x => `<li style="margin-bottom:6px;">${x}</li>`).join('')}
      </ul>`;
    box.style.display = 'block';
    document.getElementById('explorationBlock').style.display = 'block';
  }

  if (window.__explorationResult) {
    const box = document.getElementById('explorationResults');
    let html = `<h2 style="font-size:15px; margin:0 0 6px;">ملخص الاستكشاف</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 14px;">
        العلاقات المؤهلة: ${window.__explorationResult.qualified_relations.length} من ${window.__explorationResult.candidates_generated} مرشحًا.
      </p>`;
    if (window.__explorationResult.qualified_relations.length === 0) {
      html += `<div class="verdict">
        <div class="label">نتيجة الاستكشاف</div>
        <div class="point" style="font-size:16px;">لا توجد نتائج مؤهلة في هذه المحاولة</div>
        <div class="reason">لم يتم العثور على علاقات مؤهلة في هذه المحاولة. لا يعني ذلك عدم وجود علاقات في المادة. أعد محاولة الاستكشاف للحصول على قراءة أخرى، وإذا تكررت النتيجة يمكنك مراجعة المادة يدويًا.</div>
      </div>`;
    } else {
      html += `<p style="font-size:13px; color:var(--muted);">العلاقات المؤهلة جاهزة للانتقال لمرحلة الاكتشاف مجتمعة.</p>`;
      document.getElementById('discoveryBlock').style.display = 'block';
    }
    box.innerHTML = html;
    box.style.display = 'block';
  }

  if (window.__qualifiedDirections !== null && window.__qualifiedDirections !== undefined) {
    renderDirectionCards(window.__qualifiedDirections || [], window.__pendingDiscoveries || []);
    document.getElementById('directionsBlock').style.display = 'block';

    if (window.__approvedDirections && window.__approvedDirections.length > 0) {
      const approveBtn = document.getElementById('approveAllBtn');
      const badge = document.getElementById('approvedAllBadge');
      if (approveBtn) approveBtn.style.display = 'none';
      if (badge) badge.classList.add('show');
      document.getElementById('reportBlock').style.display = 'block';
    }
  }

  if (window.__approvedDirections && window.__approvedDirections.length > 0) {
    renderClientReport();
  }

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
function newProject() {
  // تفريغ حقول المشروع
  document.getElementById('projName').value = '';
  document.getElementById('projField').value = '';
  document.getElementById('projProduct').value = '';
  document.getElementById('q1').value = '';
  document.getElementById('q2').value = '';
  document.getElementById('q3').value = '';
  document.getElementById('q4').value = '';

  // تصفير حالة المشروع الحالي
  window.__lastResult = null;
  window.__lastProject = null;
  window.__stage1Result = null;
  window.__stage2Result = null;
  window.__explorationResult = null;
  window.__discoveryResults = null;
  window.__qualifiedDirections = null;
  window.__pendingDiscoveries = null;
  window.__approvedDirections = null;
  window.__currentStage = null;
  window.__currentProjectId = null;

  // إغلاق قائمة المشاريع وإعادة الواجهة لحالة نظيفة
  closeProjectList();
  restoreUIFromState();

  // العودة إلى أعلى الصفحة لبدء المشروع الجديد
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
