function addressTarget(raw) {
  const input = String(raw ?? '').trim();
  if (!input) throw new Error('请输入网址、关键词或想搜索的问题');
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    if (url.username || url.password) throw new Error('请使用不含账号密码的网址');
    return url.href;
  }
  const host = /^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,63}|\d{1,3}))(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;
  if (host.test(input)) return new URL(`https://${input}`).href;
  if (/^(?:https?|javascript|data|file|vbscript|about|chrome|ftp|mailto):/i.test(input) || /^[a-z][a-z\d+.-]*:\/\//i.test(input)) {
    throw new Error('仅支持 http / https 网址，也可以直接输入搜索内容');
  }
  return `https://www.baidu.com/s?wd=${encodeURIComponent(input)}`;
}
module.exports = { addressTarget };
