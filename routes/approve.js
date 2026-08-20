const express = require('express');
const router = express.Router();

// POST /api/approve
// المدخل: { qualifiedDirections: [...], startingPointLabel, projectName }
// المخرج: { approvedDirections: [...] }
// منطق بحت — بلا أي استدعاء AI، منقول حرفيًا من approveAllDirections في v0.1
router.post('/approve', (req, res) => {
  const { qualifiedDirections, startingPointLabel, projectName } = req.body || {};

  if (!Array.isArray(qualifiedDirections) || qualifiedDirections.length === 0) {
    return res.status(400).json({ error: 'لا توجد أفكار تنفيذ مؤهلة لاعتمادها.' });
  }

  const approvedAt = new Date().toISOString();
  const approvedDirections = qualifiedDirections.map(d => ({
    source: d.source,
    discovery_text: d.discovery_text,
    execution_point: d.execution_point,
    selection_reason: d.selection_reason,
    approved_at: approvedAt,
    starting_point: startingPointLabel || null,
    project_name: projectName || null
  }));

  return res.json({ approvedDirections });
});

module.exports = router;
