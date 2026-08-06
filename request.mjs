import fs from 'node:fs';
import path from 'node:path';

const eventName = process.env.EVENT_NAME || 'workflow_dispatch';
const issueBody = process.env.ISSUE_BODY || '';
const manualRequest = process.env.MANUAL_REQUEST || '';
const request = (eventName === 'issues' ? issueBody : manualRequest).trim();

if (!request) {
  throw new Error('The Construction Bot request is empty.');
}

if (request.length > 20_000) {
  throw new Error('The request is too long. Keep it under 20,000 characters.');
}

fs.mkdirSync('.construction-bot', { recursive: true });
fs.writeFileSync('.construction-bot/request.txt', request, 'utf8');
fs.writeFileSync(
  '.construction-bot/request.json',
  JSON.stringify(
    {
      eventName,
      issueNumber: process.env.ISSUE_NUMBER || null,
      issueTitle: process.env.ISSUE_TITLE || null,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Captured a ${request.length}-character Construction Bot request.`);
