import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requestPath = '.construction-bot/request.txt';
const planPath = '.construction-bot/plan.json';
const indexPath = 'index.html';

if (!process.env.GITHUB_TOKEN) {
  throw new Error(
    'GITHUB_TOKEN is missing. Confirm the workflow grants copilot-requests: write.',
  );
}

if (!fs.existsSync(requestPath)) {
  throw new Error(`${requestPath} was not created by request.mjs.`);
}

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html was not found. The filename must use a lowercase i.');
}

fs.mkdirSync('.construction-bot', { recursive: true });
fs.rmSync(planPath, { force: true });

const prompt = `
You are the RideTalk Construction Bot running inside a reviewed GitHub Actions job.

Read these two files:
1. ${requestPath}
2. ${indexPath}

Create exactly one file:
${planPath}

Do not edit index.html or any other repository file.

The plan file must be valid JSON with exactly this shape:
{
  "summary": "short summary",
  "operations": [
    {
      "find": "exact existing text copied from index.html",
      "replace": "replacement text",
      "expectedMatches": 1
    }
  ],
  "manualChecks": ["short check"]
}

Safety and quality rules:
- Make the smallest change that fulfills the approved request.
- Preserve all unrelated RideTalk features.
- Every find value must be copied exactly from the current index.html.
- Prefer unique exact replacements with expectedMatches set to 1.
- Use no more than 24 operations.
- Do not add credentials, tokens, passwords, analytics, tracking, hidden downloads,
  remote control, eval, new Function, document.write, or obfuscated code.
- Do not weaken microphone, camera, location, notification, email, file, GitHub,
  or browser permission requirements.
- Do not auto-merge or publish directly to main.
- Do not remove diagnostics, Repair Bot, Moderator Bot, rollback safety, or approval
  controls unless the request explicitly asks for that removal.
- Keep Android Chrome and mobile layouts working.
- If the request cannot be completed safely with exact replacements, create a plan
  with an empty operations array and explain the reason in summary.
- Write JSON only to ${planPath}.
`.trim();

const result = spawnSync(
  'copilot',
  [
    '-p',
    prompt,
    '--allow-tool=read,write(.construction-bot/plan.json)',
    '--deny-tool=shell,url,memory',
    '--no-ask-user',
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      COPILOT_AUTO_UPDATE: 'false',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (result.error) {
  throw new Error(`GitHub Copilot CLI could not start: ${result.error.message}`);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  throw new Error(
    `GitHub Copilot CLI failed with exit code ${result.status}. ` +
    'Confirm that Copilot is available for the account and that Copilot CLI ' +
    'requests are allowed for this repository.',
  );
}

if (!fs.existsSync(planPath)) {
  throw new Error(
    `GitHub Copilot finished without creating ${planPath}.`,
  );
}

let plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (error) {
  throw new Error(`Copilot created invalid JSON: ${error.message}`);
}

if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
  throw new Error('The Copilot plan must be a JSON object.');
}

if (typeof plan.summary !== 'string' || !plan.summary.trim()) {
  throw new Error('The Copilot plan has no summary.');
}

if (!Array.isArray(plan.operations)) {
  throw new Error('The Copilot plan has no operations array.');
}

if (plan.operations.length === 0) {
  throw new Error(
    `Copilot could not create a safe exact-replacement plan: ${plan.summary}`,
  );
}

if (plan.operations.length > 24) {
  throw new Error('The Copilot plan contains more than 24 operations.');
}

for (const [index, operation] of plan.operations.entries()) {
  if (!operation || typeof operation !== 'object') {
    throw new Error(`Operation ${index + 1} is not an object.`);
  }

  if (typeof operation.find !== 'string' || operation.find.length === 0) {
    throw new Error(`Operation ${index + 1} has no exact find text.`);
  }

  if (typeof operation.replace !== 'string') {
    throw new Error(`Operation ${index + 1} has no replacement text.`);
  }

  const expectedMatches = Number(operation.expectedMatches ?? 1);
  if (
    !Number.isInteger(expectedMatches) ||
    expectedMatches < 1 ||
    expectedMatches > 10
  ) {
    throw new Error(
      `Operation ${index + 1} has an invalid expectedMatches value.`,
    );
  }

  operation.expectedMatches = expectedMatches;

  if (operation.find.length > 80_000 || operation.replace.length > 80_000) {
    throw new Error(`Operation ${index + 1} is too large.`);
  }
}

if (!Array.isArray(plan.manualChecks)) {
  plan.manualChecks = [];
}

plan.manualChecks = plan.manualChecks
  .filter((item) => typeof item === 'string' && item.trim())
  .slice(0, 20);

fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
console.log(
  `GitHub Copilot generated ${plan.operations.length} exact replacement operation(s).`,
);
