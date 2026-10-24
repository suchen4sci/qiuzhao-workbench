const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = [...fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).sort(), ...["metadata-form-flow.cjs", "layui-controls-flow.cjs", "control-dispatcher-flow.cjs", "ant-controls-flow.cjs", "ant-calendar-flow.cjs", "engine-section-scan-flow.cjs", "form-cell-records-flow.cjs", "render-health-flow.cjs", "sd-form-flow.cjs", "aircas-flow.cjs", "wjx-flow.cjs", "legacy-controls-flow.cjs", "phoenix-month-flow.cjs", "public-smoke.cjs"]];
const started = Date.now();
if (process.argv.includes('--list')) { console.log(tests.join('\n')); process.exit(0); }
async function run(file, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, file.endsWith('.test.cjs') ? ['--test', file] : [file], {
      cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
    });
    let output = '', failed;
    const capture = chunk => { output = (output + chunk.toString()).slice(-1024 * 1024); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const timeout = setTimeout(() => {
      failed = 'Regression timed out after 180 seconds';
      // Terminate only this isolated suite and its Electron descendants before another suite could start.
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }, 180000);
    child.on('error', error => { failed = error.message; });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, output, failed }); });
  });
}
(async () => { for (const [index, name] of tests.entries()) {
  const file = path.join(root, 'tests', name);
  if (!fs.existsSync(file)) { console.error(`FAIL missing regression: ${name}`); process.exit(1); }
  const env = { ...process.env, QIUZHAO_TEST: '1', QIUZHAO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'qiuzhao-regression-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = await run(file, env);
  if (result.failed || result.code !== 0) {
    console.error(`FAIL ${index + 1}/${tests.length} ${name}`);
    if (result.output) process.stderr.write(result.output);
    if (result.failed) console.error(result.failed);
    process.exit(result.code || 1);
  }
  console.log(`PASS ${index + 1}/${tests.length} ${name}`);
}
console.log(`Regression passed: ${tests.length} suites, ${((Date.now() - started) / 1000).toFixed(1)}s`);
})().catch(error => { console.error(error.message); process.exit(1); });
