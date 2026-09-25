const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const fs=require('node:fs');const root=path.resolve(__dirname,'../..');
env.QIUZHAO_WORKSPACE ||= path.join(root,'.local-workspace');
if(!fs.existsSync(path.join(env.QIUZHAO_WORKSPACE,'知识库/profile.json')))require('../../tools/copy-tree.cjs').copyTree(path.join(root,'examples/demo-workspace'),env.QIUZHAO_WORKSPACE);
// Pass an explicit ephemeral port: Electron's DevToolsActivePort file can be stale.
const server = net.createServer();
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  server.close(() => {
    // This is the user-facing app. Hiding this process also hides its native window.
    const child = spawn(require('electron'), [`--remote-debugging-port=${port}`, path.resolve(__dirname, '..')], { env, stdio: 'inherit', windowsHide: false });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code || 0; });
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
