import json

with open('extracted_prompts.json', encoding='utf-8') as f:
    prompts = json.load(f)

def js_module(exports_dict):
    lines = []
    for name, text in exports_dict.items():
        # backtick literal آمن لأن القيمة الأصلية أصلًا كانت بين backticks في v0.1
        escaped = text.replace('\\', '\\\\').replace('`', '\\`')
        lines.append(f"const {name} = `{escaped}`;")
    exports_line = "module.exports = { " + ", ".join(exports_dict.keys()) + " };"
    return "\n\n".join(lines) + "\n\n" + exports_line + "\n"

groups = {
    'decision.js': ['SYSTEM_PROMPT', 'TIE_BREAK_SYSTEM_PROMPT'],
    'stage1.js': ['STAGE1_SYSTEM_PROMPT'],
    'stage2.js': ['STAGE2_SYSTEM_PROMPT'],
    'exploration.js': ['EXPLORATION_SYSTEM_PROMPT', 'EXPLORATION_JUDGE_SYSTEM_PROMPT'],
    'discovery.js': ['DISCOVERY_GEN_SYSTEM_PROMPT', 'DISCOVERY_JUDGE_SYSTEM_PROMPT'],
    'executionIdea.js': ['EXECUTION_IDEA_GEN_SYSTEM_PROMPT', 'EXECUTION_IDEA_JUDGE_SYSTEM_PROMPT'],
}

for filename, keys in groups.items():
    subset = {k: prompts[k] for k in keys}
    content = js_module(subset)
    path = f'backend/prompts/{filename}'
    with open(path, 'w', encoding='utf-8') as out:
        out.write(content)
    print(f"كُتب: {path} ({', '.join(keys)})")
