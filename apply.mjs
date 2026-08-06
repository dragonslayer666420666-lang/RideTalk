import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync('.construction-bot/plan.json', 'utf8'));
const original = fs.readFileSync('index.html', 'utf8');
let updated = original;
const applied = [];

for (const [index, operation] of plan.operations.entries()) {
  const expected = Number(operation.expectedMatches || 1);
  const actual = updated.split(operation.find).length - 1;

  if (actual !== expected) {
    throw new Error(
      `Operation ${index + 1} expected ${expected} exact match(es), but found ${actual}. No partial update was committed.`,
    );
  }

  updated = updated.split(operation.find).join(operation.replace);
  applied.push({
    operation: index + 1,
    expectedMatches: expected,
    findLength: operation.find.length,
    replaceLength: operation.replace.length,
  });
}

if (updated === original) {
  throw new Error('The generated operations did not change index.html.');
}

const forbidden = [
  /github_pat_[A-Za-z0-9_]+/,
  /ghp_[A-Za-z0-9]+/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
];
for (const pattern of forbidden) {
  if (pattern.test(updated)) {
    throw new Error(`A possible secret matched ${pattern}. The update was blocked.`);
  }
}

fs.writeFileSync('index.html', updated, 'utf8');

const report = `# RideTalk Construction Bot proposal\n\n` +
  `Nothing in this pull request is merged automatically. Review the diff and checks first.\n\n` +
  `## Summary\n\n${plan.summary || 'No summary supplied.'}\n\n` +
  `## Applied operations\n\n${applied.map((item) => `- Operation ${item.operation}: ${item.expectedMatches} exact replacement(s); ${item.findLength} characters replaced with ${item.replaceLength} characters.`).join('\n')}\n\n` +
  `## Manual checks\n\n${(plan.manualChecks || []).map((item) => `- ${item}`).join('\n') || '- Open RideTalk on Android Chrome and test the changed feature while stopped.'}\n\n` +
  `## Rollback\n\nIf this pull request is merged and causes a problem, run the **RideTalk Construction Bot Rollback** workflow and enter this pull-request number.\n`;

fs.writeFileSync('.construction-bot/change-report.md', report, 'utf8');
console.log(`Applied ${applied.length} operation(s) to index.html.`);
