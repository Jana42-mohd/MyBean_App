// Runs the unit tests:  npm test
// Compiles the plain-logic modules in lib/ with tsc (no React Native needed), then runs every tests/*.test.js with
// Node's built-in test runner. Anything that talks to the phone or the backend is replaced by stand-ins in tests/_mocks.js.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bean-tests-'));
const files = [
  'growth', 'whoGrowthData', 'insights', 'time', 'babies', 'liveSync', 'outbox', 'netError', 'logs', 'logActions',
  'timer', 'legal', 'appInfo', 'reminders',
].map(f => `lib/${f}.ts`);

execSync(`npx tsc ${files.join(' ')} --outDir "${out}" --module commonjs --target es2020 --skipLibCheck --esModuleInterop --noCheck`, {
  cwd: root,
  stdio: 'inherit',
});

const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f));
const res = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', env: { ...process.env, TEST_BUILD: out } });
fs.rmSync(out, { recursive: true, force: true });
process.exit(res.status ?? 1);
