// دوال عرض بحتة — منقولة شبه حرفيًا من v0.1. لا تحتوي أي منطق تأهيل أو AI.
// الفرق الوحيد عن v0.1: renderResults تستقبل بيانات جاهزة من استجابة /api/decision
// بدل بنائها من استجابة OpenAI مباشرة — الشكل النهائي المعروض للمستخدم مطابق تمامًا.

function renderResults(data) {
  const order = ['name', 'letter', 'product', 'value'];
  const winnerKey = data.starting_point;
  let maxTotal = -1;
  order.forEach(k => { if (data.candidates[k] && data.candidates[k].total > maxTotal) maxTotal = data.candidates[k].total; });

  let tableHTML = `<tr><th>نقطة الانطلاق</th><th>المجموع</th><th></th></tr>`;
  order.forEach(k => {
    const c = data.candidates[k];
    if (!c) return;
    const isWinner = k === winnerKey;
    tableHTML += `<tr class="${isWinner ? 'winner' : ''}">
      <td>${c.label}</td>
      <td class="num">${c.total} / 6</td>
      <td><details><summary>التفاصيل</summary>
        ${c.conditions.map(cond => `
          <div class="cond-row">
            <span class="id">${cond.id}</span>
            <span class="reason">${cond.reason}</span>
            <span class="val">${cond.score}</span>
          </div>`).join('')}
      </details></td>
    </tr>`;
  });
  document.getElementById('scoreTable').innerHTML = tableHTML;

  const verdictEl = document.getElementById('verdict');
  if (data.insufficient_result || !winnerKey) {
    verdictEl.innerHTML = `
      <div class="label">النتيجة</div>
      <div class="point">لا توجد نقطة انطلاق قوية بما يكفي</div>
      <div class="reason">يحتاج المشروع تحليلًا إضافيًا أو معلومات أدق من العميل قبل اعتماد نقطة بداية.</div>`;
  } else {
    const winnerLabel = data.candidates[winnerKey].label;
    verdictEl.innerHTML = `
      <div class="label">نقطة البداية المعتمدة</div>
      <div class="point">${winnerLabel}</div>
      ${data.tie_break_applied ? `<div class="tie-note">⚖️ تم تفعيل كسر التعادل: ${data.tie_break_reason}</div>` : ''}
    `;
    document.getElementById('methodCard').style.display = 'block';
  }

  document.getElementById('results').classList.add('active');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDirectionCards(directions, pending) {
  pending = pending || [];
  const box = document.getElementById('directionsResults');

  let html = '';

  if (directions.length === 0 && pending.length === 0) {
    html = `<div class="verdict">
      <div class="label">نتائج الاكتشاف</div>
      <div class="point" style="font-size:16px;">لا توجد نتائج مؤهلة في هذه المحاولة</div>
      <div class="reason">لم يجتز أي اكتشاف مراحل التحقق حتى نهاية فكرة تنفيذ الشعار في هذه المحاولة. لا يعني ذلك عدم وجود اكتشاف أو فكرة تنفيذ في هذه العلاقات. أعد محاولة الاكتشاف للحصول على قراءة أخرى، وإذا تكررت النتيجة يمكنك مراجعة المادة يدويًا.</div>
    </div>`;
  } else {
    if (directions.length > 0) {
      html += `<div class="card">
        <h2 style="font-size:15px; margin:0 0 6px;">أفكار تنفيذ الشعار المؤهلة (${directions.length})</h2>
        <p style="font-size:13px; color:var(--muted); margin:0 0 16px;">معروضة جميعها دون ترتيب أو تفضيل — المصمم حر في تنفيذ واحدة، بعضها، أو جميعها.</p>`;
      directions.forEach((d, i) => {
        html += `<div style="border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:12px;">
          <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">فكرة تنفيذ الشعار</div>
          <div style="font-size:15px; font-weight:700; margin-bottom:12px;">${d.execution_point}</div>
          <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">المصدر (الاكتشاف)</div>
          <div style="font-size:14px; margin-bottom:12px;">${d.discovery_text}</div>
          <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">مسار الاشتقاق</div>
          <div style="font-size:14px;">${d.selection_reason}</div>
        </div>`;
      });
      html += `<button class="confirm-btn" id="approveAllBtn" onclick="handleApproveAllDirections()">اعتماد نتائج الاكتشاف</button>
        <div class="confirmed-box" id="approvedAllBadge">✓ تم اعتماد نتائج الاكتشاف — يمكنك الآن إنشاء تقرير العميل.</div>
      </div>`;
    }

    if (pending.length > 0) {
      html += `<div class="card" style="margin-top:${directions.length > 0 ? '16px' : '0'};">
        <h2 style="font-size:15px; margin:0 0 6px;">اكتشافات معتمدة — لم يتم الوصول بعد إلى فكرة تنفيذ مؤهلة (${pending.length})</h2>
        <p style="font-size:13px; color:var(--muted); margin:0 0 16px;">هذا لا يعني أن الاكتشاف غير صالح؛ فشل عدد محدود من محاولات الاجتهاد الآلي لا يثبت عدم وجود فكرة تنفيذ في المشروع. أعد محاولة "بدء الاكتشاف" للحصول على اجتهاد جديد على هذا الاكتشاف، وإذا تكررت النتيجة يمكنك مراجعة الاكتشاف يدويًا.</p>`;
      pending.forEach((p, i) => {
        html += `<div style="border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:12px;">
          <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">الاكتشاف</div>
          <div style="font-size:14px;">${p.discovery_text}</div>
        </div>`;
      });
      html += `</div>`;
    }
  }

  box.innerHTML = html;

  document.getElementById('directionsBlock').style.display = 'block';
  document.getElementById('directionsBlock').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// دالة عرض فقط — لا تُعدّل أي بيانات مخزَّنة، منقولة حرفيًا من v0.1
function humanizeForClientReport(text) {
  if (!text) return text;
  return text
    .replace(/discovery_text/g, 'نتائج الاكتشاف')
    .replace(/source_relation_ids/g, 'العلاقات المصدر')
    .replace(/derivation_trace/g, 'مسار الاشتقاق')
    .replace(/execution_idea/g, 'فكرة تنفيذ الشعار')
    .replace(/execution_point/g, 'فكرة الشعار')
    .replace(/meaning_text/g, 'معنى الاكتشاف');
}

function renderClientReport() {
  const box = document.getElementById('reportResults');
  const list = window.__approvedDirections;
  if (!list || list.length === 0) { return; }
  window.__currentStage = 'report';

  let html = `<div class="verdict">
    <div class="label">تقرير العميل — مسودة</div>
    <div class="point" style="font-size:16px;">${window.__lastProject || ''}</div>
    <div class="reason">نقطة البداية المعتمدة: ${list[0].starting_point}</div>
  </div>`;

  list.forEach(d => {
    html += `<div style="border:1px solid var(--line); border-radius:8px; padding:14px; margin-top:10px;">
      <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">فكرة الشعار</div>
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">${d.execution_point}</div>
      <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">القصة التي بُنيت عليها الفكرة</div>
      <div style="font-size:14px; margin-bottom:12px;">${d.discovery_text}</div>
      <div style="font-size:13px; color:var(--muted); margin-bottom:6px;">لماذا هذه الفكرة تحديدًا</div>
      <div style="font-size:13px; color:var(--muted);">${humanizeForClientReport(d.selection_reason)}</div>
    </div>`;
  });

  html += `<p style="font-size:12px; color:var(--muted); margin-top:10px;">مسودة أولية — الصياغة النهائية الموجّهة للعميل بلغة تسويقية كاملة خارج نطاق هذا التعديل.</p>`;
  box.innerHTML = html;
  box.style.display = 'block';
  document.getElementById('printReportBtn').style.display = 'block';
}
