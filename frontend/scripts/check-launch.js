// Fails while launch placeholders are still in the code:  npm run check:launch
const fs = require('fs');
const path = require('path');

const problems = [];
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// 1. [[PLACEHOLDERS]] in the app facts
for (const m of read('lib/appInfo.ts').matchAll(/export const (\w+) = '([^']*)'/g)) {
  if (/\[\[.*\]\]/.test(m[2])) problems.push(`lib/appInfo.ts: ${m[1]} is still ${m[2]}`);
}

// 2. app ids
const app = JSON.parse(read('app.json')).expo;
if (app.ios?.bundleIdentifier === 'com.mylittlebean.app') problems.push('app.json: ios.bundleIdentifier is still the default com.mylittlebean.app (cannot change after the first store release)');
if (app.android?.package === 'com.mylittlebean.app') problems.push('app.json: android.package is still the default com.mylittlebean.app (cannot change after the first store release)');
if (!app.extra?.eas?.projectId) problems.push('app.json: extra.eas.projectId missing. Run `npx eas-cli init` first');

// 3. Expo template images
const crypto = require('crypto');
const known = { 'cb975bba2216ce10a60e6c0ffe9941a2': 'icon.png is still the Expo template icon' };
const icon = crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'assets/images/icon.png'))).digest('hex');
if (known[icon]) problems.push(known[icon]);

if (problems.length) {
  console.error('Not ready to ship:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('Launch checks passed.');
