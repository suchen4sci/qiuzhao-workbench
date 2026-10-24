const {test}=require('node:test'),assert=require('node:assert/strict');
const {_electron}=require('playwright-core'),path=require('path'),fs=require('fs'),os=require('os');
const {executeControl}=require('../src/control-dispatcher.cjs');
const {fillSelect2Multiple}=require('../src/select2-multiple.cjs');
test('Select2 searches its open dropdown despite another visible inline search, and preserves multiple selection',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'select2-test-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});try{
 await app.firstWindow();let p;for(let i=0;i<50;i++){p=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(p)break;await new Promise(r=>setTimeout(r,100));}assert.ok(p);
 await p.setContent(`<div class="select2-container"><span id="school" class="select2-selection"><span class="select2-selection__rendered"><span class="select2-selection__placeholder">请选择学校</span></span></span></div>
 <select id="cities" multiple style="display:none"><option value="a">甲市</option><option value="b">乙市</option></select><div class="select2-container"><span class="select2-selection"><ul class="select2-selection__rendered"></ul><input class="select2-search__field"></span></div>
 <script>
 const school=document.querySelector('#school');school.onclick=()=>{school.setAttribute('aria-expanded','true');school.setAttribute('aria-owns','school-options');const d=document.createElement('div');d.className='select2-dropdown';d.innerHTML='<input class="select2-search__field"><div id="school-options" class="select2-results">请输入搜索词</div>';document.body.append(d);const other=document.createElement('div');other.className='select2-results';other.textContent='Unrelated visible picker';document.body.append(other);d.querySelector('input').oninput=e=>{d.querySelector('.select2-results').innerHTML='<div class="select2-results__option">Fixture University</div>';d.querySelector('.select2-results__option').onclick=()=>{school.querySelector('.select2-selection__rendered').textContent='Fixture University';school.setAttribute('aria-expanded','false');d.remove();other.remove()}}};
 const cities=document.querySelector('#cities'),widget=cities.nextElementSibling;widget.querySelector('.select2-selection').onclick=()=>{if(document.querySelector('.city-options'))return;const d=document.createElement('div');d.className='city-options select2-results';[...cities.options].filter(o=>!o.selected).forEach(o=>{const e=document.createElement('div');e.className='select2-results__option';e.textContent=o.textContent;e.onclick=event=>{event.stopPropagation();o.selected=true;const tag=document.createElement('li');tag.className='select2-selection__choice';tag.textContent='×'+o.textContent;widget.querySelector('ul').append(tag);d.remove()};d.append(e)});document.body.append(d)};
 </script>`);
 const r=await executeControl(p,p.locator('#school'),{value:'Fixture University',allowOverwrite:true});assert.equal(r.status,'filled');assert.equal(await p.locator('#school').textContent(),'Fixture University');
 assert.equal((await fillSelect2Multiple(p,p.locator('#cities'),['甲市','乙市'])).status,'filled');assert.equal((await fillSelect2Multiple(p,p.locator('#cities'),['甲市','乙市'])).status,'existing');
 assert.deepEqual(await p.locator('#cities').evaluate(e=>[...e.selectedOptions].map(o=>o.value)),['a','b']);
 await assert.rejects(fillSelect2Multiple(p,p.locator('#cities'),['甲市']),/已有额外/);
 }finally{await app.close()}
});

