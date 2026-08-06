import fs from 'node:fs';

const token = process.env.GITHUB_TOKEN;
const model = process.env.MODEL_ID || 'openai/gpt-4.1';

if (!token) throw new Error('GITHUB_TOKEN is missing.');

const request = fs.readFileSync('.construction-bot/request.txt', 'utf8');
const original = fs.readFileSync('index.html', 'utf8');

const system = `You are the RideTalk Construction Bot. You modify one public GitHub Pages file: index.html.
Return JSON only with this exact shape:
{
  "summary": "short summary",
  "operations": [
    {"find": "exact existing text", "replace": "replacement text", "expectedMatches": 1}
  ],
  "manualChecks": ["short check"]
}

Rules:
- Make the smallest change that fulfills the request.
- Preserve all unrelated RideTalk features.
- Each find value must be copied exactly from the supplied current index.html.
- Use at most 24 operations.
- Each operation must have find, replace, and expectedMatches.
- expectedMatches must be 1 unless repeating an identical safe change is necessary.
- Do not add credentials, API keys, access tokens, passwords, analytics, tracking, remote-control behavior, hidden downloads, eval, new Function, document.write, or obfuscated code.
- Do not weaken microphone, camera, location, notification, GitHub, email, file, or browser permission requirements.
- Do not auto-merge, self-modify the GitHub repository from the public page, or expose GITHUB_TOKEN.
- Do not remove the Repair Bot, Moderator Bot, diagnostics, rollback safety, or user approval controls unless explicitly requested.
- Keep mobile Android Chrome usability.
- If the request is unsafe, impossible in a static page, or cannot be expressed as exact replacements, return an empty operations array and explain why in summary.`;

const response = await fetch('https://models.github.ai/inference/chat/completions', {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2026-03-10',
  },
  body: JSON.stringify({
    model,
    temperature: 0.1,
    max_tokens: 24_000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `REQUEST:\n${request}\n\nCURRENT index.html:\n${original}`,
      },
    ],
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`GitHub Models request failed (${response.status}): ${body.slice(0, 2000)}`);
}

const payload = await response.json();
const content = payload?.choices?.[0]?.message?.content;
if (!content) throw new Error('GitHub Models returned no plan.');

let plan;
try {
  plan = JSON.parse(content);
} catch {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  plan = JSON.parse(cleaned);
}

if (!plan || typeof plan !== 'object' || !Array.isArray(plan.operations)) {
  throw new Error('The generated plan is not valid JSON.');
}
if (plan.operations.length === 0) {
  throw new Error(`The bot could not create a safe exact-replacement plan: ${plan.summary || 'No explanation supplied.'}`);
}
if (plan.operations.length > 24) {
  throw new Error('The generated plan has more than 24 operations.');
}

for (const [index, operation] of plan.operations.entries()) {
  if (typeof operation.find !== 'string' || !operation.find) {
    throw new Error(`Operation ${index + 1} has no exact find text.`);
  }
  if (typeof operation.replace !== 'string') {
    throw new Error(`Operation ${index + 1} has no replacement text.`);
  }
  operation.expectedMatches = Number(operation.expectedMatches || 1);
  if (!Number.isInteger(operation.expectedMatches) || operation.expectedMatches < 1 || operation.expectedMatches > 10) {
    throw new Error(`Operation ${index + 1} has an invalid expectedMatches value.`);
  }
  if (operation.find.length > 80_000 || operation.replace.length > 80_000) {
    throw new Error(`Operation ${index + 1} is too large.`);
  }
}

fs.writeFileSync('.construction-bot/plan.json', JSON.stringify(plan, null, 2), 'utf8');
console.log(`Generated ${plan.operations.length} exact replacement operation(s).`);
