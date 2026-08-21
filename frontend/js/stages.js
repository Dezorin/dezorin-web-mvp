// معالجات المراحل — نفس منطق v0.1 حرفيًا في التصفير والشروط وتسلسل إظهار الكتل.
// الفرق الوحيد: الاستدعاء الفعلي يمر عبر Api.* (خادم Dezorin) بدل fetch مباشر لـOpenAI.
// لا يوجد هنا أي منطق حَكَم أو شرط تأهيل — كله على الخادم الآن.

async function runEngine() {
  const btn = document.getElementById('runBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const errorBox = document.getElementById('errorBox');

  const projName = document.getElementById('projName').value.trim();
  const projField = document.getElementById('projField').value.trim();
  const projProduct = document.getElementById('projProduct').value.trim();
  const q1 = document.getElementById('q1').value.trim();
  const q2 = document.getElementById('q2').value.trim();
  const q3 = document.getElementById('q3').value.trim();
  const q4 = document.getElementById('q4').value.trim();

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!projName || !q1 || !q2 || !q3 || !q4) {
    errorBox.textContent = 'يرجى تعبئة اسم المشروع وكل الأسئلة الأربعة قبل التحليل.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;
  status.classList.add('active');
  results.classList.remove('active');
  document.getElementById('methodCard').style.display = 'none';
  document.getElementById('stage2Block').style.display = 'none';
  document.getElementById('explorationBlock').style.display = 'none';
  document.getElementById('discoveryBlock').style.display = 'none';
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';
  document.getElementById('stage1Results').style.display = 'none';

  window.__stage1Result = null;
  window.__stage2Result = null;
  window.__explorationResult = null;
  window.__discoveryResults = null;
  window.__qualifiedDirections = null;
  window.__pendingDiscoveries = null;
  window.__approvedDirections = null;
  window.__currentProjectId = null;
  window.__currentStage = null;

  try {
    const parsed = await Api.decision({ projName, projField, projProduct, q1, q2, q3, q4 });

    renderResults(parsed);
    window.__lastResult = parsed;
    window.__lastProject = projName;
    window.__currentStage = 'decision';

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'حدث خطأ أثناء التحليل: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
    status.classList.remove('active');
  }
}

async function runStage1() {
  const btn = document.getElementById('stage1Btn');
  const status = document.getElementById('stage1Status');
  const errorBox = document.getElementById('stage1Error');
  const resultsBox = document.getElementById('stage1Results');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!window.__lastResult || !window.__lastResult.starting_point) {
    errorBox.textContent = 'لا توجد نقطة بداية معتمدة بعد.';
    errorBox.classList.add('active');
    return;
  }

 if (!window.__currentProjectId) {
  const saved = await saveProject();

  if (!saved || !window.__currentProjectId) {
    errorBox.textContent = 'تعذّر حفظ المشروع قبل المتابعة.';
    errorBox.classList.add('active');
    return;
  }
}

try {
  await Api.unlockProject(window.__currentProjectId);
} catch (err) {
  if (err.message === 'لا يوجد رصيد مشاريع كافٍ.') {
    errorBox.innerHTML = `
      <strong>انتهت المرحلة المجانية من المشروع.</strong><br>
      للمتابعة إلى بقية مراحل Dezorin، يلزم شراء المشروع.<br><br>
      <a href="purchase.html"
         style="display:inline-block; padding:10px 18px; background:#111; color:#fff; text-decoration:none; border-radius:8px;">
        شراء المشروع
      </a>
    `;
  } else {
    errorBox.textContent =
      err.message || 'تعذّر فتح المشروع. حاول مرة أخرى.';
  }

  errorBox.classList.add('active');
  return;
}
  
  const winnerKey = window.__lastResult.starting_point;
  const winnerLabel = window.__lastResult.candidates[winnerKey].label;
  const q1 = document.getElementById('q1').value.trim();
  const q2 = document.getElementById('q2').value.trim();
  const q3 = document.getElementById('q3').value.trim();
  const q4 = document.getElementById('q4').value.trim();

  btn.disabled = true;
  status.classList.add('active');
  resultsBox.style.display = 'none';
  document.getElementById('stage2Block').style.display = 'none';
  document.getElementById('explorationBlock').style.display = 'none';
  document.getElementById('discoveryBlock').style.display = 'none';
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';

  try {
    const data = await Api.stage1({ winnerLabel, q1, q2, q3, q4 });
    window.__stage1Result = data;
    window.__currentStage = 'stage1';

    let html = `<h2 style="font-size:15px; margin:0 0 10px;">المادة المنقولة إلى التفكيك</h2>
      <ul style="margin:0; padding-right:20px; font-size:14px; color:var(--text);">
        ${data.transferred_material.map(x => `<li style="margin-bottom:6px;">${x}</li>`).join('')}
      </ul>`;
    resultsBox.innerHTML = html;
    resultsBox.style.display = 'block';

    document.getElementById('stage2Block').style.display = 'block';
    document.getElementById('stage2Block').scrollIntoView({ behavior: 'smooth', block: 'end' });

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'حدث خطأ أثناء التحليل: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
    status.classList.remove('active');
  }
}

async function runStage2() {
  const btn = document.getElementById('stage2Btn');
  const status = document.getElementById('stage2Status');
  const errorBox = document.getElementById('stage2Error');
  const resultsBox = document.getElementById('stage2Results');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!window.__stage1Result) {
    errorBox.textContent = 'نفّذ مرحلة التحليل أولًا.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;
  status.classList.add('active');
  resultsBox.style.display = 'none';
  document.getElementById('explorationBlock').style.display = 'none';
  document.getElementById('discoveryBlock').style.display = 'none';
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';

  try {
    const data = await Api.stage2({ transferredMaterial: window.__stage1Result.transferred_material });

    data.units_meta = Array.isArray(data.units_meta) ? data.units_meta : [];
    data.links = Array.isArray(data.links) ? data.links : [];

    window.__stage2Result = data;
    window.__currentStage = 'stage2';

    let html = `<h2 style="font-size:15px; margin:0 0 10px;">نتيجة التفكيك</h2>
      <ul style="margin:0; padding-right:20px; font-size:14px; color:var(--text);">
        ${data.breakdown.map(x => `<li style="margin-bottom:6px;">${x}</li>`).join('')}
      </ul>`;
    resultsBox.innerHTML = html;
    resultsBox.style.display = 'block';

    document.getElementById('explorationBlock').style.display = 'block';
    document.getElementById('explorationBlock').scrollIntoView({ behavior: 'smooth', block: 'end' });

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'حدث خطأ أثناء التفكيك: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
    status.classList.remove('active');
  }
}

async function runExploration() {
  const btn = document.getElementById('explorationBtn');
  const status = document.getElementById('explorationStatus');
  const errorBox = document.getElementById('explorationError');
  const resultsBox = document.getElementById('explorationResults');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!window.__stage2Result) {
    errorBox.textContent = 'نفّذ مرحلة التفكيك أولًا.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;
  status.classList.add('active');
  resultsBox.style.display = 'none';
  document.getElementById('discoveryBlock').style.display = 'none';
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';
  window.__explorationResult = null;
  window.__discoveryResults = null;
  window.__qualifiedDirections = null;
  window.__pendingDiscoveries = null;
  window.__approvedDirections = null;

  try {
    const result = await Api.explore({ breakdown: window.__stage2Result.breakdown });
    window.__explorationResult = result;
    window.__currentStage = 'exploration';

    let html = `<h2 style="font-size:15px; margin:0 0 6px;">ملخص الاستكشاف</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 14px;">
        العلاقات المؤهلة: ${result.qualified_relations.length} من ${result.candidates_generated} مرشحًا.
      </p>`;

    if (result.qualified_relations.length === 0) {
      html += `<div class="verdict">
        <div class="label">نتيجة الاستكشاف</div>
        <div class="point" style="font-size:16px;">لا توجد نتائج مؤهلة في هذه المحاولة</div>
        <div class="reason">لم يتم العثور على علاقات مؤهلة في هذه المحاولة. لا يعني ذلك عدم وجود علاقات في المادة. أعد محاولة الاستكشاف للحصول على قراءة أخرى، وإذا تكررت النتيجة يمكنك مراجعة المادة يدويًا.</div>
      </div>`;
    } else {
      html += `<p style="font-size:13px; color:var(--muted);">العلاقات المؤهلة جاهزة للانتقال لمرحلة الاكتشاف مجتمعة.</p>`;
      document.getElementById('discoveryBlock').style.display = 'block';
    }

    resultsBox.innerHTML = html;
    resultsBox.style.display = 'block';
    resultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'حدث خطأ أثناء الاستكشاف: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
    status.classList.remove('active');
  }
}

async function runDiscoveryAndBridge() {
  const btn = document.getElementById('discoveryBtn');
  const status = document.getElementById('discoveryStatus');
  const errorBox = document.getElementById('discoveryError');

  errorBox.classList.remove('active');
  errorBox.textContent = '';

  if (!window.__explorationResult || !window.__explorationResult.qualified_relations || window.__explorationResult.qualified_relations.length === 0) {
    errorBox.textContent = 'لا توجد علاقات مؤهلة من الاستكشاف للانتقال منها للاكتشاف.';
    errorBox.classList.add('active');
    return;
  }

  btn.disabled = true;
  status.classList.add('active');
  document.getElementById('directionsBlock').style.display = 'none';
  document.getElementById('reportBlock').style.display = 'none';

  try {
    const { qualifiedDirections, pendingDiscoveries } = await Api.discover({
      qualifiedRelations: window.__explorationResult.qualified_relations,
      transferredMaterial: window.__stage1Result ? window.__stage1Result.transferred_material : []
    });

    window.__qualifiedDirections = qualifiedDirections;
    window.__pendingDiscoveries = pendingDiscoveries;
    window.__currentStage = 'discovery';
    renderDirectionCards(qualifiedDirections, pendingDiscoveries);

  } catch (err) {
    console.error(err);
    errorBox.textContent = 'حدث خطأ أثناء الاكتشاف/فكرة تنفيذ الشعار: ' + err.message;
    errorBox.classList.add('active');
  } finally {
    btn.disabled = false;
    status.classList.remove('active');
  }
}

// ملاحظة تسمية: اسمها في v0.1 كان approveAllDirections وكانت متزامنة (منطق بحت بلا شبكة).
// أصبحت هنا async لأنها تستدعي /api/approve — لذا سُمّيت handleApproveAllDirections
// لتمييزها بوضوح كمعالج حدث غير متزامن. هذا الاسم الوحيد الذي تغيّر عن v0.1 في هذا الملف.
async function handleApproveAllDirections() {
  const starting = window.__lastResult ? window.__lastResult.candidates[window.__lastResult.starting_point].label : null;

  try {
    const { approvedDirections } = await Api.approve({
      qualifiedDirections: window.__qualifiedDirections,
      startingPointLabel: starting,
      projectName: window.__lastProject || null
    });

    window.__approvedDirections = approvedDirections;
    window.__currentStage = 'approved';

    document.getElementById('approveAllBtn').style.display = 'none';
    document.getElementById('approvedAllBadge').classList.add('show');

    document.getElementById('reportBlock').style.display = 'block';
    document.getElementById('reportBlock').scrollIntoView({ behavior: 'smooth', block: 'end' });

  } catch (err) {
    console.error(err);
    alert('تعذّر اعتماد النتائج: ' + err.message);
  }
}
