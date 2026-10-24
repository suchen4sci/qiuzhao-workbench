const {_electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {executeControl}=require('../src/control-dispatcher.cjs');
(async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'ant-calendar-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<80;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page);
  await page.setContent(`<meta charset="utf-8"><style>.ant-calendar{background:white;border:1px solid black;padding:8px;margin:4px}a{display:inline-block;min-width:30px;padding:3px;cursor:pointer}input{display:block}.ant-calendar-year-panel-cell,.ant-calendar-cell{display:inline-block;padding:3px}</style>
   <div id="fields"></div><script>
   window.events={day:0,month:0,maxPopups:0};
   window.addCalendar=(id,monthOnly=false)=>{
    const item=document.createElement('div');item.className='ant-form-item';item.innerHTML='<div class="ant-form-item-label"><label>'+id+'</label></div><span class="ant-calendar-picker"><input id="'+id+'" readonly></span>';document.querySelector('#fields').append(item);
    const input=item.querySelector('input');input.onclick=()=>{
     const popup=document.createElement('div');popup.className='ant-calendar'+(monthOnly?' ant-calendar-month':'');popup.tabIndex=0;document.body.append(popup);events.maxPopups=Math.max(events.maxPopups,document.querySelectorAll('.ant-calendar').length);
     let year=2026,month=9,mode=monthOnly?'months':'days',decade=2020;
     const close=()=>setTimeout(()=>popup.remove(),220);popup.onkeydown=e=>{if(e.key==='Escape')close()};item.querySelector('label').onclick=close;
     const add=(parent,cls,text,fn)=>{const a=document.createElement('a');a.className=cls;a.textContent=text;a.onclick=fn;parent.append(a);return a};
     const draw=()=>{popup.innerHTML='';
      if(mode==='years'){
       add(popup,'ant-calendar-year-panel-prev-decade-btn','prev',()=>{decade-=10;draw()});add(popup,'ant-calendar-year-panel-next-decade-btn','next',()=>{decade+=10;draw()});
       for(let y=decade;y<decade+10;y++){const cell=document.createElement('div');cell.className='ant-calendar-year-panel-cell';popup.append(cell);add(cell,'ant-calendar-year-panel-year',String(y),()=>{year=y;mode=monthOnly?'months':'days';draw()})}
      }else if(mode==='months'){
       const panel=document.createElement('div');panel.className='ant-calendar-month-panel';popup.append(panel);
       add(panel,'ant-calendar-month-panel-year-select',String(year),()=>{mode='years';draw()});
       for(let m=1;m<=12;m++)add(panel,'ant-calendar-month-panel-month',String(m),()=>{month=m;if(monthOnly){events.month++;input.value=year+'-'+String(m).padStart(2,'0');close()}else{mode='days';draw()}});
      }else{
       const panel=document.createElement('div');panel.className='ant-calendar-date-panel';popup.append(panel);
       add(panel,'ant-calendar-year-select',String(year),()=>{mode='years';draw()});add(panel,'ant-calendar-month-select',String(month),()=>{mode='months';draw()});
       for(let day=1;day<=31;day++){const cell=document.createElement('div');cell.className='ant-calendar-cell';panel.append(cell);add(cell,'ant-calendar-date',String(day),()=>{events.day++;input.value=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');close()})}
      }
     };draw();
    };
   };addCalendar('stale');addCalendar('start');addCalendar('end');addCalendar('month',true);addCalendar('incomplete');addCalendar('invalid');
   </script>`);
  const fill=(id,value)=>executeControl(page,page.locator('#'+id),{value});
  await page.locator('#stale').click();assert.equal(await page.locator('.ant-calendar').count(),1);
  assert.equal((await fill('start','2002-05-28')).value,'2002-05-28');assert.equal(await page.locator('.ant-calendar').count(),0);
  assert.equal((await fill('end','2026-08-29')).value,'2026-08-29');assert.equal(await page.locator('.ant-calendar').count(),0);
  assert.equal((await fill('month','2024-09')).value,'2024-09');assert.equal(await page.locator('.ant-calendar').count(),0);
  await assert.rejects(fill('incomplete','2025-01'),e=>e.code==='DATE_PRECISION');assert.equal(await page.locator('#incomplete').inputValue(),'');
  await assert.rejects(fill('invalid','2025-02-30'),e=>e.code==='CALENDAR');
  assert.deepEqual(await page.evaluate(()=>events),{day:2,month:1,maxPopups:1});
  console.log(JSON.stringify({passed:true,uiCalendarClicks:true,yearMonthDay:true,monthPicker:true,noInventedDay:true,stalePopupClosed:true,waitsForClosingAnimation:true,noOverlappingPopups:true}));
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
