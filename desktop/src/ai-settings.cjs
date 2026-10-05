const fs = require('node:fs');
const path = require('node:path');

function validateSettings(input) {
  const enabled = input.enabled === true;
  const baseUrl = String(input.baseUrl || '').trim().replace(/\/+$/, '');
  const model = String(input.model || '').trim();
  if (baseUrl) {
    let url;
    try { url = new URL(baseUrl); } catch { throw Error('请输入有效的 AI 服务地址'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw Error('服务地址须为 HTTPS；本机模型可使用 HTTP，不允许账号、查询参数或片段');
  }
  if (enabled && (!baseUrl || !model)) throw Error('启用 AI 前请填写服务地址和模型名称');
  if (model.length > 200) throw Error('模型名称过长');
  return { enabled, baseUrl, model };
}

function createAISettings(userData, storage) {
  const file = path.join(userData, 'ai-settings.json');
  function read() {
    let saved = {};
    if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    let apiKey = '';
    if (saved.encryptedKey) {
      try { apiKey = storage.decryptString(Buffer.from(saved.encryptedKey, 'base64')); }
      catch { throw Error('无法解密 API Key，请在 AI 设置中重新保存'); }
    }
    return { ...validateSettings(saved), apiKey };
  }
  function publicSettings() {
    try { const { apiKey, ...config } = read(); return { ...config, hasKey: !!apiKey }; }
    catch { return { enabled: false, baseUrl: '', model: '', hasKey: false, keyUnavailable: true }; }
  }
  function save(input) {
    const config = validateSettings(input);
    let apiKey = input.clearKey ? '' : String(input.apiKey || '').trim();
    if (!apiKey && !input.clearKey) { try { apiKey = read().apiKey; } catch {} }
    if (/\r|\n/.test(apiKey) || apiKey.length > 4096) throw Error('API Key 格式无效');
    const weakLinux = storage.getSelectedStorageBackend?.() === 'basic_text';
    if (apiKey && (!storage.isEncryptionAvailable() || weakLinux)) throw Error('系统密钥加密不可用，未保存 API Key；请先启用系统钥匙串');
    const saved = { ...config, encryptedKey: apiKey ? storage.encryptString(apiKey).toString('base64') : '' };
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(saved, null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
    return publicSettings();
  }
  return { read, save, publicSettings };
}
module.exports = { validateSettings, createAISettings };
