const test = require('node:test');
const assert = require('node:assert/strict');
const { addressTarget } = require('../src/navigation.cjs');
test('Chinese natural-language queries and keywords go to search unchanged', () => {
  for (const query of ['华为校招', '帮我找北京的芯片验证岗位', '2027届 校招 芯片设计', '帮我查一下example.com', 'AI: hardware jobs']) {
    const url = new URL(addressTarget(`  ${query}  `));
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.searchParams.get('wd'), query);
  }
});
test('URLs and bare domains still navigate directly', () => {
  assert.equal(addressTarget('job.icbc.com.cn/pc/index.html'), 'https://job.icbc.com.cn/pc/index.html');
  assert.equal(addressTarget('https://example.com/jobs?q=校招'), new URL('https://example.com/jobs?q=校招').href);
  assert.equal(addressTarget('http://localhost:8080/form'), 'http://localhost:8080/form');
  assert.equal(addressTarget('localhost:8080/form'), 'https://localhost:8080/form');
});
test('blank input and executable schemes are rejected', () => {
  for (const input of ['', '   ', 'javascript:alert(1)', 'file:///C:/private', 'data:text/html,test', 'https://user:secret@example.com']) assert.throws(() => addressTarget(input));
});
