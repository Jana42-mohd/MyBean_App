// Writes docs/legal/*.md from lib/legal.ts (the single source the app also uses).  npm run legal:export
// Publish those files (or paste them into your website) to get the public Privacy Policy URL the stores require.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
execSync(`npx tsc lib/legal.ts lib/appInfo.ts --outDir "${tmp}" --module commonjs --target es2020 --skipLibCheck`, { cwd: root, stdio: 'inherit' });

const legal = require(path.join(tmp, 'legal.js'));
const info = require(path.join(tmp, 'appInfo.js'));
const values = {
  APP_NAME: info.APP_NAME, OWNER_NAME: info.OWNER_NAME, SUPPORT_EMAIL: info.SUPPORT_EMAIL, DATA_REGION: info.DATA_REGION,
  EMAIL_PROVIDER: info.EMAIL_PROVIDER, BACKUP_DAYS: info.BACKUP_DAYS, GOVERNING_LAW: info.GOVERNING_LAW, POLICY_UPDATED: info.POLICY_UPDATED,
};

const out = path.join(root, '..', 'docs', 'legal');
fs.mkdirSync(out, { recursive: true });
const render = doc =>
  `# ${doc.title}\n\n` +
  doc.sections
    .map(s => `## ${s.heading}\n\n` + s.body.map(p => legal.fillPlaceholders(p, values)).join('\n\n'))
    .join('\n\n') + '\n';

fs.writeFileSync(path.join(out, 'PRIVACY_POLICY.md'), render(legal.PRIVACY));
fs.writeFileSync(path.join(out, 'TERMS_OF_SERVICE.md'), render(legal.TERMS));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Wrote docs/legal/PRIVACY_POLICY.md and TERMS_OF_SERVICE.md');
