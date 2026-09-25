const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

function sourceVersion() {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:cjs|js)$/.test(entry.name)) files.push(file);
    }
  };
  visit(path.join(root, 'src'));
  files.push(path.join(root, 'scripts/update-live-engine.cjs'));
  const restoreScript = path.join(root, 'scripts/restore-window.ps1');
  if (fs.existsSync(restoreScript)) files.push(restoreScript);
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) hash.update(path.relative(root, file).replaceAll('\\', '/')).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex').slice(0, 12);
}

// Capture at process load, rather than claiming edited files are already running.
const loadedVersion = sourceVersion();
function runtimeInfo(mode, extra = {}) {
  return { engineVersion: loadedVersion, mode, pid: process.pid,
    sourceChanged: sourceVersion() !== loadedVersion, hostSync: mode === 'main' ? 'connected' : 'unavailable', ...extra };
}
function withRuntime(report, mode, extra) { return { ...report, runtime: runtimeInfo(mode, extra) }; }
module.exports = { runtimeInfo, withRuntime, sourceVersion };
