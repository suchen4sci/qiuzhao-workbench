const fs = require('node:fs');
const path = require('node:path');

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error('模板目录不允许符号链接');
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  }
}

function ensureWorkspace({ root, userData, resourcesPath, packaged, configured }) {
  const workspace = path.resolve(configured || (packaged ? path.join(userData, 'workspace') : path.join(root, '.local-workspace')));
  if (fs.existsSync(path.join(workspace, '知识库/profile.json'))) return workspace;
  // Recognized workspaces with history must remain openable for recovery.
  if (fs.existsSync(path.join(workspace, '.workbench/profile-history'))) return workspace;
  if (fs.existsSync(workspace)) throw Error('工作区已存在但缺少 知识库/profile.json，请选择有效资料目录；现有文件未覆盖');
  // An explicitly selected personal workspace must never receive demo facts.
  const source = path.join(packaged ? resourcesPath : root, 'templates/blank-workspace');
  copyTree(source, workspace);
  return workspace;
}
module.exports = { copyTree, ensureWorkspace };
