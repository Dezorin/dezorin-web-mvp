// اختبار مطابقة نصية حرفية للبرومبتات — Checkpoint 6 (بند 1: مقارنة نصية للبرومبتات)
// يقرأ نص كل Prompt مباشرة من ملف v0.1 المرجعي (بلا تعديل)، ويقارنه حرفيًا
// بالنص المستخدَم فعليًا في ملفات backend/prompts/*.js
// نجاح الاختبار = صفر فروقات. أي فرق ولو حرف واحد يُفشل الاختبار عمدًا.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REFERENCE_PATH = path.join(__dirname, '..', '..', 'reference', 'dezorin-v0.1-REFERENCE-DO-NOT-EDIT.html');

function extractPromptsFromReference() {
  const src = fs.readFileSync(REFERENCE_PATH, 'utf-8');
  const pattern = /const ([A-Z0-9_]+_PROMPT) = `([\s\S]*?)`;/g;
  const result = {};
  let m;
  while ((m = pattern.exec(src)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

const referencePrompts = extractPromptsFromReference();

const backendModules = {
  ...require('../prompts/decision'),
  ...require('../prompts/stage1'),
  ...require('../prompts/stage2'),
  ...require('../prompts/exploration'),
  ...require('../prompts/discovery'),
  ...require('../prompts/executionIdea'),
};

describe('مطابقة نصية حرفية للبرومبتات مقابل v0.1 المرجعية', () => {
  const expectedNames = [
    'SYSTEM_PROMPT',
    'TIE_BREAK_SYSTEM_PROMPT',
    'STAGE1_SYSTEM_PROMPT',
    'STAGE2_SYSTEM_PROMPT',
    'EXPLORATION_SYSTEM_PROMPT',
    'EXPLORATION_JUDGE_SYSTEM_PROMPT',
    'DISCOVERY_GEN_SYSTEM_PROMPT',
    'DISCOVERY_JUDGE_SYSTEM_PROMPT',
    'EXECUTION_IDEA_GEN_SYSTEM_PROMPT',
    'EXECUTION_IDEA_JUDGE_SYSTEM_PROMPT',
  ];

  test('كل البرومبتات العشرة موجودة في v0.1 المرجعية', () => {
    expectedNames.forEach(name => {
      assert.ok(referencePrompts[name], `Prompt غير موجود في v0.1 المرجعية: ${name}`);
    });
  });

  test('كل البرومبتات العشرة موجودة في ملفات backend', () => {
    expectedNames.forEach(name => {
      assert.ok(backendModules[name], `Prompt غير موجود في backend: ${name}`);
    });
  });

  expectedNames.forEach(name => {
    test(`تطابق حرفي: ${name}`, () => {
      assert.strictEqual(
        backendModules[name],
        referencePrompts[name],
        `الفرق موجود في ${name} — النقل ليس حرفيًا 100%`
      );
    });
  });
});
