import re

with open('reference/dezorin-v0.1-REFERENCE-DO-NOT-EDIT.html', encoding='utf-8') as f:
    src = f.read()

# استخراج كل الثوابت بصيغة: const NAME = `....`;  (قد تحتوي backticks متداخلة عبر ${...} فقط، لا backtick حرفي داخل هذه البرومبتات)
pattern = re.compile(r'const ([A-Z0-9_]+_PROMPT) = `(.*?)`;', re.S)
matches = pattern.findall(src)

names = [m[0] for m in matches]
print(f"عدد البرومبتات المستخرجة: {len(matches)}")
for n in names:
    print(" -", n)

import json
with open('extracted_prompts.json', 'w', encoding='utf-8') as out:
    json.dump({name: text for name, text in matches}, out, ensure_ascii=False, indent=2)
