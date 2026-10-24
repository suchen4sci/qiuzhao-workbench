const {executeControl}=require('./control-dispatcher.cjs');


const { groups, normalize, sectionFrom, matchField } = require('./rules.cjs');
const { learnedMatch } = require('./learned-fields.cjs');


const { controlValue } = require('./control-value.cjs');
const { ensureProjects } = require('./add-projects.cjs');
const { ensureAwards } = require('./add-awards.cjs');

// Read-only frame scan. Local values establish record identity and verify confirmed answers.
function inspectDocument() {
  const visible = el => !!(el?.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const labelText = node => { const clone = node.cloneNode(true); clone.querySelectorAll('input,textarea,select,button,[role="combobox"],.labelRequired,.remarkShow,[role="tooltip"],.anticon,.el-tooltip__popper').forEach(el => el.remove()); return clone.textContent.replace(/^[*＊\s]+|[*＊\s：:]+$/g,'').trim(); };
  const selectedText = node => {
    if(node.classList?.contains('multi_select_info'))return [...node.querySelectorAll('[class*="sd-Tag-text-"]')].map(e=>e.textContent.trim()).join(',');
    const selected=node.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item,.phoenix-select__calcEle,[class*="sd-Input-display-value-"]');
    if(selected){const copy=selected.cloneNode(true);copy.querySelectorAll('[class*="sd-Select-ghost-"]').forEach(e=>e.remove());return copy.textContent.trim();}
    const input=node.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]),textarea,select');
    return String(input?.tagName==='SELECT'?input.selectedOptions[0]?.textContent||'':input?.value||'').trim();
  };
  const nativeRadioRoot=node=>{
    if(!node?.matches('fieldset,[role="radiogroup"],.radio_list,dt,dd')||node.matches('.ant-radio-group,.phoenix-radio-group'))return false;
    const radios=[...node.querySelectorAll('input[type="radio"]')];
    return radios.length>0&&radios.every(r=>r.name&&r.name===radios[0].name&&r.form===radios[0].form)&&!node.querySelector('input:not([type="radio"]),textarea,select');
  };
  const fileSurface=el=>el.closest('[class*="apply-field-"]')||el.closest('.file-single-wrap,.el-upload,[data-upload]')||el.closest('.ant-form-item,.el-form-item,.layui-form-item,.form-item,.form-group,.field')||el.closest('.ant-upload')||(el.parentElement?.matches('body,html')?null:el.parentElement);
  const selector = el => {
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const siblings = [...n.parentElement.children].filter(s => s.tagName === n.tagName);
      parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(n) + 1})`);
    }
    return `html > ${parts.join(' > ')}`;
  };
  return [...document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"],.phoenix-select,.phoenix-radio-group,.ant-select,.ant-radio-group,.layui-form-select,.slt,.dateSlt,dt,dd,fieldset,[role="radiogroup"],.radio_list,dt,dd')]
    .filter(el=>!el.matches('select.citySelect')||el.parentElement.querySelector('select.citySelect')===el)
    .filter(el=>!el.matches('fieldset,[role="radiogroup"],.radio_list,dt,dd')||nativeRadioRoot(el))
    .filter(el=>!nativeRadioRoot(el.parentElement?.closest('fieldset,[role="radiogroup"],.radio_list,dt,dd')))
    .filter(el => !el.parentElement?.closest('.phoenix-select,.phoenix-radio-group,.ant-select,.ant-radio-group,.layui-form-select'))
    .filter(el=>!el.matches('#phoneTypeSel,#sIDCard,#sPhoneNumber'))
    .filter(el => !el.closest('.el-input-group__prepend,.apply-form-date-now__node'))
    .filter(el => (visible(el)||(el.type==='file'&&visible(fileSurface(el)))) && !el.matches('input[type="hidden"], input[type="submit"], input[type="button"], input[type="reset"]'))
    .filter(el=>el.type!=='file'||fileSurface(el)?.querySelector('input[type="file"]')===el)
    .filter(el=>!(el.matches('input.layui-disabled')&&el.closest('.layui-form-item')?.querySelector('input[type="file"]')))
    .filter(el => !/搜索职位/.test((el.getAttribute('title')||'')+(el.getAttribute('placeholder')||'')))
    .filter(el => !el.closest('.constant-main-selector-container,.area-selector-container,.bas_select_ctt_wrap,.phoenix-calendar-month-calendar'))
    .filter(el => !(el.closest('[class*="sd-Select-container-"]') && el.closest('[class*="apply-field-"]')?.querySelectorAll('input').length>1 && /^(手机号码|证件号码)$/.test(el.closest('[class*="apply-field-"]').querySelector(':scope > [class*="title-"]')?.textContent.trim()||'')))
    .filter(el => !el.matches('[role="combobox"]') || !el.querySelector('input,select'))
    .map(el => {
      const labels = [...(el.labels || [])].map(labelText);
      const wtField=el.closest('dy-form');
      if(wtField&&el.getAttribute('msg'))labels.unshift(el.getAttribute('msg'));
      if(wtField&&!el.getAttribute('msg')){const title=el.closest('dy-form-special')?.querySelector('input[type=hidden][msg]')?.getAttribute('msg');if(title)labels.unshift(title);}
      const definition=el.closest('dl');
      const definitionTitle=definition?.querySelector(':scope > dt');
      if(definitionTitle)labels.push(labelText(definitionTitle).replace(/\s*\*\s*$/,''));
      if(el.matches('.slt')&&labels.includes('证件号码')&&definition?.querySelector('input.inputxt'))labels.splice(0,labels.length,'证件类型');
      if(el.matches('dt')&&el.querySelector('input[type=radio]')){let text='';for(const n of el.childNodes){if(n.nodeType===1&&n.matches('input[type=radio]'))break;text+=n.textContent;}labels.splice(0,labels.length,text.replace(/[*＊]/g,'').trim());}
      const dictionarySelect=el.matches('.custom-combobox-input')?el.closest('dd')?.querySelector('select[cname]'):null;
      const tierSelects=definition?[...definition.querySelectorAll('select')].filter(visible):[];const metadataTier=tierSelects.length>1&&tierSelects.some(s=>/DDL_OnChange1/.test(s.getAttribute('onchange')||''))?tierSelects.indexOf(el):undefined;
      const metadataName=el.getAttribute('cname')||dictionarySelect?.getAttribute('cname');
      if(metadataName)labels.unshift(metadataName);
      const uploadSurface=el.type==='file'?fileSurface(el):null;
      const nativeRadioGroup=nativeRadioRoot(el);
      if(nativeRadioGroup){const legend=el.querySelector(':scope > legend');if(legend)labels.push(labelText(legend));}
      const structuredField=el.closest('[class*="apply-field-"]');
      if(structuredField){const title=structuredField.querySelector(':scope > [class*="title-"]');if(title){labels.length=0;labels.push(title.textContent.trim());}}
      let datePart;
      if(structuredField&&/^(就读时间|起止时间|毕业时间|最高学历毕业时间|获奖时间|预计获取双证时间|预计取得双证时间)$/.test(labels[0])){
        const parts=[...structuredField.querySelectorAll('input')].filter(n=>n.closest('[class*="sd-Select-container-"]'));
        if([2,4].includes(parts.length)&&parts.includes(el)&&parts.every((n,i)=>!n.placeholder||n.placeholder===(i%2?'月':'年'))){
          const i=parts.indexOf(el);if(parts.length===4)labels[0]=labels[0]==='就读时间'?(i<2?'入学时间':'毕业时间'):(i<2?'开始时间':'结束时间');datePart=i%2?'month':'year';
        }
      }
      const adjacentTitle=el.closest('.form-info')?.previousElementSibling;
      if(adjacentTitle?.matches('.form-title')){labels.length=0;labels.push(adjacentTitle.textContent.replace(/^[*\s]+|[：:\s]+$/g,''));}
      if (el.getAttribute('aria-labelledby')) labels.push(el.getAttribute('aria-labelledby').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
      const item = el.closest('.el-form-item,.ant-form-item,.form-item,.form-group,.field,.van-field,.layui-form-item,td,li:has(> label)');
      if(el.matches('select.sel_date_year,select.sel_date_month')){datePart=el.matches('.sel_date_year')?'year':'month';const end=/(End|Leave|Finish)(Date|Time)?_/i.test(el.name);labels.length=0;labels.push(end?'结束时间':'开始时间');}
      const itemLabel = item?.querySelector('label,.el-form-item__label,.ant-form-item-label,.label,.form-item__title');
      if (itemLabel && !datePart && !adjacentTitle?.matches('.form-title')) labels.push(labelText(itemLabel));
      if(uploadSurface&&!labels.length){const title=uploadSurface.querySelector('button[title]')?.getAttribute('title');if(title)labels.push(title);else if(uploadSurface.querySelector('.resumeFileName'))labels.push('简历解析附件');}
      if(el.matches('.layui-form-select')&&itemLabel){
        const prior=item?.previousElementSibling;
        if(!labelText(itemLabel)&&prior?.querySelector('label')?.textContent.replace(/[*\s]/g,'')==='技能'){labels.length=0;labels.push('技能名称');}
        else if(labelText(itemLabel)==='技能'&&item?.nextElementSibling?.querySelector('select')){labels.length=0;labels.push('技能类别');}
      }
      labels.push(el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'));
      const headings = [];
      // Datang embeds independent Element dialogs in a resume iframe; use the dialog identity.
      if(location.hostname==='zhaopin.china-cdt.com'){
        const title=el.closest('.el-dialog')?.querySelector('.el-dialog__title')?.textContent.trim();
        const section={'基本信息修改':'基本信息','家庭成员及回避关系':'家庭关系','自我评价':'自我评价'}[title];
        if(section)headings.push(section);
      }
      // Tencent uses plain div subtitles rather than label/form-item markup.
      const tencentSection=location.hostname==='join.qq.com'&&el.closest('li.send_box');
      const tencentField=tencentSection&&el.closest('.info_box');
      if(tencentField){const title=tencentField.querySelector(':scope > .subtitle');if(title){labels.length=0;labels.push(labelText(title));}}
      if(tencentSection){const title=tencentSection.querySelector(':scope > .send_title');if(title){const text=labelText(title);headings.push({'意向信息':'求职意向','获奖信息':'奖励荣誉'}[text]||text);}}
      const wtSection=wtField?.closest('.edit-resume-div');
      if(wtSection)headings.push(wtSection.querySelector('.mdf-tit p')?.textContent.trim()||'');
      const legacyRecord=el.closest('.form_container')?.closest('form');
      const legacyTitle=el.closest('.form_container')?.querySelector(':scope > h2.form_title strong');
      if(legacyTitle)headings.push(legacyTitle.textContent.trim());
      const formCell=el.closest('.form-cell');
      const cellTitle=formCell?.querySelector(':scope > .tit-wrap > .tit > p');
      if(cellTitle)headings.push(labelText(cellTitle));
      const structuredBlock=el.closest('[data-nav-id]');
      if(structuredBlock){const title=structuredBlock.querySelector('[class*="blockTitle-"] [class*="text-"]');if(title)headings.push(title.textContent.trim());}
      const moduleTitle=el.closest('.apply-module')?.querySelector('.form-content--title');
      if(moduleTitle) headings.push(moduleTitle.textContent.trim());
      const cellRecord=el.closest('.form-cell-inner');
      let block = metadataName&&el.closest('.ci')?selector(el.closest('.ci')):legacyRecord?selector(legacyRecord):cellRecord?selector(cellRecord):'';
      const phoenixForm = el.closest('.ux-standard-form');
      const recordIdentity = {};
      if(tencentSection){
        const row=el.closest('.info_list');
        if(row){block=selector(row);for(const field of row.querySelectorAll('.info_box')){
          const title=field.querySelector(':scope > .subtitle');if(!title)continue;
          const label=labelText(title),value=selectedText(field);if(!value)continue;
          if(label==='学历')recordIdentity.level=value;
          if(label==='学校名称')recordIdentity.school=value;
          if(label==='公司')recordIdentity.company=value;
          if(label==='项目名称')recordIdentity.project=value;
          if(label==='奖项名称')recordIdentity.award=value;
        }}
        if(labels[0]==='起止时间'){
          const dates=[...tencentField.querySelectorAll('.el-date-editor input')];
          if(dates.length===2&&dates.includes(el))labels[0]=/教育/.test(headings[0])?(dates.indexOf(el)===0?'入学时间':'毕业时间'):(dates.indexOf(el)===0?'开始时间':'结束时间');
        }
        const aliases={'个人证件':'身份证号','当前所处地':'现居住地','公司':'公司名称','在项目中担任的角色':'项目职务','奖项说明':'获奖描述'};
        if(aliases[labels[0]])labels[0]=aliases[labels[0]];
        if(labels[0]==='描述')labels[0]=/实习/.test(headings[0])?'工作描述':/项目/.test(headings[0])?'项目描述':'描述';
        // Country prefix and developer-language search inputs are not phone/skill values.
        if(el.closest('.my-selent-phone'))labels[0]='手机国家区号';
      }
      const wtRecord=wtField?.closest('[id^="subGroup_"]');
      if(wtRecord){block=selector(wtRecord);for(const c of wtRecord.querySelectorAll('[msg]')){const label=c.getAttribute('msg');const value=c.tagName==='SELECT'?c.selectedOptions[0]?.textContent.trim():c.value;if(!value||value==='请选择')continue;if(label==='学历')recordIdentity.level=value;if(label==='企业名称')recordIdentity.company=value;if(label==='项目名称')recordIdentity.project=value;if(label==='奖励名称')recordIdentity.award=value;if(label==='活动名称')recordIdentity.campus=value;if(label==='姓名')recordIdentity.name=value;}}
      if(definition){const editor=el.closest('.secC');if(editor)for(const d of editor.querySelectorAll('dl')){const label=labelText(d.querySelector(':scope > dt'));const input=d.querySelector('input:not([type=radio]):not([type=checkbox]),textarea');const choice=d.querySelector('.slt > span');const value=(choice?.textContent||input?.value||'').trim();if(!value||/^(请输入|请选择|输入)/.test(value))continue;if(/^(亲属姓名|成员姓名|家属姓名)$/.test(label))recordIdentity.name=value;if(/^(关系|与本人关系|称谓)$/.test(label))recordIdentity.relation=value;}}
      const metadataSkill=definition?el.closest('.ci')?.querySelector('select[cname="技能"]'):null;
      if(metadataSkill?.value)recordIdentity.skillName=metadataSkill.selectedOptions[0]?.textContent.trim();
      if(metadataSkill&&labels[0]==='技能')labels.unshift(metadataTier===0?'技能类别':'技能名称');
      const qualification=metadataName?.match(/^(本科|硕士(?:研究生)?|博士(?:研究生)?)(.+)$/);
      if(qualification){recordIdentity.level=qualification[1].startsWith('硕士')?'硕士研究生':qualification[1].startsWith('博士')?'博士研究生':'本科';labels.push(qualification[2]==='毕业学校'?'学校名称':qualification[2]);}
      if(legacyRecord){for(const f of legacyRecord.querySelectorAll('li:has(> label)')){const name=labelText(f.querySelector(':scope > label')),value=selectedText(f);if(name==='学校名称')recordIdentity.school=value;if(name==='学历')recordIdentity.level=value;if(name==='项目名称')recordIdentity.project=value;if(name==='单位名称')recordIdentity.company=value;if(name==='奖项')recordIdentity.award=value;if(name==='技能名称')recordIdentity.skillName=value;}const idType=legacyRecord.querySelector('select[name$="_CertificateType"]');if(idType)recordIdentity.idType=idType.selectedOptions[0]?.textContent.trim();}
      const layuiForm=el.closest('form');
      if(el.closest('.layui-form-item')&&layuiForm)for(const f of layuiForm.querySelectorAll('.layui-form-item')){
        if(!visible(f))continue;
        const title=f.querySelector('.layui-form-label');if(!title)continue;
        const label=labelText(title),native=f.querySelector('select'),value=native?native.selectedOptions[0]?.textContent.trim():f.querySelector('input,textarea')?.value;
        if(!value)continue;
        if(label==='证件类型')recordIdentity.idType=value;
        if(label==='学校名称')recordIdentity.school=value;
        if(label==='学历')recordIdentity.level=value==='硕士研究生毕业'?'硕士研究生':value==='大学本科毕业'?'本科':value;
        if(label==='项目名称')recordIdentity.project=value;
        if(label==='奖励表彰名称')recordIdentity.award=value;
        if(label==='单位'||label==='单位名称')recordIdentity.company=value;
      }
      if(cellRecord)for(const field of cellRecord.querySelectorAll('.ant-form-item')){
        if(!visible(field))continue;
        const title=field.querySelector('.ant-form-item-label');
        if(!title)continue;
        const label=labelText(title),value=selectedText(field);
        if(!value)continue;
        if(/^(学校|学校名称|毕业院校|院校名称)$/.test(label))recordIdentity.school=value;
        if(/^(学历|教育程度|学历层次)$/.test(label))recordIdentity.level=value==='硕士'?'硕士研究生':value==='博士'?'博士研究生':value;
        if(/^(姓名|成员姓名|家属姓名)$/.test(label))recordIdentity.name=value;
        if(/^(关系|与本人关系|称谓)$/.test(label))recordIdentity.relation=value;
        if(/^(公司名称|工作单位|实习单位)$/.test(label))recordIdentity.company=value;
        if(/^(项目名称|实践名称)$/.test(label))recordIdentity.project=value;
        if(/^(获奖项|奖项名称|奖励名称)$/.test(label))recordIdentity.award=value;
        if(/^(开发语言|技能名称|专业技能)$/.test(label))recordIdentity.skillName=value;
        if(/^(证件类型|证件号码类型)$/.test(label))recordIdentity.idType=value;
      }
      const structuredRecord=el.closest('[class*="apply-fields-"]');
      if(structuredRecord){block=selector(structuredRecord);}
      if(structuredRecord)for(const f of structuredRecord.querySelectorAll('[class*="apply-field-"]')){
        const name=f.querySelector(':scope > [class*="title-"]')?.textContent.trim();
        const value=f.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()||f.querySelector('input')?.value||'';
        if(name==='学校名称')recordIdentity.school=value;
        if(name==='学历'||name==='最高学历')recordIdentity.level=value==='硕士'?'硕士研究生':value==='博士'?'博士研究生':value;
        if(name==='专业名称')recordIdentity.major=value;
        if(name==='公司名称')recordIdentity.company=value;
        if(name==='项目名称'){
          if(structuredBlock?.querySelector('[class*="blockTitle-"] [class*="text-"]')?.textContent.trim()==='院校经历')recordIdentity.campus=value;
          else recordIdentity.project=value;
        }
        if(name==='姓名')recordIdentity.name=value;
        if(name==='称谓')recordIdentity.relation=value;
        if(name==='奖项名称')recordIdentity.award=value;
      }
      if (phoenixForm) for (const field of phoenixForm.querySelectorAll('.form-item')) {
        const label = field.querySelector('.form-item__title')?.textContent.trim();
        if (label === '姓名') recordIdentity.name = selectedText(field);
        if (label === '与本人关系' || label === '关系') recordIdentity.relation = selectedText(field);
        if (label === '单位名称' || label === '公司名称') recordIdentity.company = selectedText(field);
        if (/^(在校)?职务名称$/.test(label)) recordIdentity.campus = selectedText(field);
        if (label === '技能名称') recordIdentity.skillName = selectedText(field);
        if (label === '学校名称') recordIdentity.school = field.querySelector('input')?.value || '';
        if (label === '学历') recordIdentity.level = field.querySelector('.phoenix-select__calcEle')?.textContent.trim() || '';
        if(label==='语言等级考试')recordIdentity.languageExam=selectedText(field);
        if (/^(获奖项|奖项)$/.test(label)) recordIdentity.award = field.querySelector('input')?.value || '';
        if (label === '实践名称' || label === '项目名称') recordIdentity.project = field.querySelector('input')?.value || '';
        if (label === '项目描述' && !recordIdentity.project) {
          const marker=field.querySelector('textarea')?.value.match(/^项目：([^\n]+)\n/);
          if(marker)recordIdentity.project=marker[1];
        }
      }
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        if (phoenixForm) {
          const title = [...node.children].find(child => !child.contains(el) && /^(个人信息|求职意向|教育经历|工作经历|实习经历|实习\/工作经历|在校实践|在校职务|学生干部经历|项目经历|论文\/专著|证书|获奖情况|语言能力|外语能力|家庭情况|家庭信息|家庭关系|家庭其他成员|技能|附加信息|附加问题)$/.test(child.textContent.trim()));
          if (title && !headings.length) { headings.push(title.textContent.trim()); block = selector(phoenixForm); }
        }
        const heading = node.querySelector(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > .section-title, :scope > header > h2, :scope > header > h3');
        if (heading && visible(heading)) { headings.push(heading.textContent.trim().slice(0, 100)); if (!block) block = selector(node); }
      }
      if (!headings.length) {
        const before = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,.section-title')].filter(h => visible(h) && (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
        if (before.length) headings.push(before.at(-1).textContent.trim().slice(0, 100));
      }
      const definitionHeader=el.closest('.secon')?.querySelector(':scope > h3.secH > span.lf');if(definitionHeader)headings.unshift(definitionHeader.textContent.trim());
      const definitionHint=el.matches('input.inputxt')&&(/^(请输入|请选择|输入毕业院校名称)/.test(el.value)||el.classList.contains('inputCity')&&labels.includes(el.value));
      const type = el.getAttribute('type') || el.tagName.toLowerCase();
      const privateType = /password|file|checkbox|radio/.test(type);
      const componentGroup=el.closest('.cascader-plugins-wrap');
      const components=componentGroup?[...componentGroup.querySelectorAll('.ant-select')].filter(visible):[];
      const checked=nativeRadioGroup||el.matches('.ant-radio-group,.phoenix-radio-group')?el.querySelector('input:checked,.ant-radio-checked,.phoenix-radio--checked'):null;
      const employmentGroup=el.closest('.el-checkbox-group');
      const employmentChoice=type==='checkbox'&&!!employmentGroup&&/期望工作性质/.test(itemLabel?.textContent||'')&&[...employmentGroup.querySelectorAll('label')].every(l=>/^(全职|兼职|实习)$/.test(l.textContent.trim()));
      const employmentGroupChecked=employmentChoice&&!!employmentGroup.querySelector('input:checked');
      const observedValue=definitionHint?'':el.matches('.slt,.dateSlt')?el.querySelector(':scope >span')?.textContent.trim()||'':el.matches('select.citySelect')?[...el.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/,'')).join('/'):el.matches('.layui-form-select')?(el.previousElementSibling?.value?el.previousElementSibling.selectedOptions?.[0]?.textContent.trim()||'':''):el.matches('.ant-select')?selectedText(el):nativeRadioGroup?[...(checked?.labels||[])].map(labelText).join(' ').trim()||checked?.getAttribute('aria-label')||checked?.nextSibling?.textContent.trim()||checked?.nextElementSibling?.textContent.trim()||'':el.matches('.ant-radio-group,.phoenix-radio-group')?checked?.closest('label')?.textContent.trim()||checked?.textContent.trim()||'':el.matches('.phoenix-select')?el.querySelector('input')?.value.trim()||el.querySelector('.phoenix-select__tag')?.textContent.trim()||'':el.closest('[class*="sd-Select-container-"]')?selectedText(el.closest('[class*="sd-Select-container-"]')):el.tagName==='SELECT'?el.selectedOptions[0]?.textContent.trim()||'':String(el.value??el.textContent??'').trim();
      return { selector: selector(el), labels: [...new Set(labels.filter(Boolean))], headings, block, metadataTier,metadataRecordDescription:metadataName?el.closest('.ci')?.querySelector('textarea[cname="项目描述"]')?.value:undefined,qualificationLevel:qualification?recordIdentity.level:undefined,structuredRecord:!!structuredRecord, phoenixRecord:!!phoenixForm, phoenixCompanyField:!!phoenixForm&&[...phoenixForm.querySelectorAll(".form-item__title")].some(e=>/^(公司名称|实习单位|单位名称)$/.test(e.textContent.trim())), sectionBlock:formCell?selector(formCell):undefined,recordIdentity,datePart,definitionRegion:el.matches('input.inputCity'),legacyRegion:el.matches('input.ConstDictSingleSelect,input.area'),legacyDate:el.matches('input.Wdate')||(el.readOnly&&/\bsetday\s*\(/.test(el.getAttribute('onfocus')||'')),
        employmentChoice,employmentGroupChecked,validationMessage:item?.querySelector('.form-item__error')?.textContent.trim(),rankPlainText:el.tagName==='INPUT'&&el.type==='text'&&!el.readOnly&&!el.closest('.phoenix-select,.ant-select,.el-select,[class*="sd-Select-container-"]')&&!el.getAttribute('role'),placeholder:el.getAttribute('placeholder'),observedValue,sdRegion:!!(el.readOnly&&el.placeholder==='请输入籍贯'&&structuredField),nativeRegion:el.matches('select.citySelect'),nativeRadioGroup,ongoingSelected:!!phoenixForm?.querySelector('input[type=checkbox]:checked'),ongoingCheckbox:el.type==='checkbox'&&el.closest('.phoenix-checkbox')?.textContent.trim()==='至今',
        sdTranscript:!!uploadSurface&&!!structuredField&&/^(请上传成绩单|成绩单|课程成绩单)$/.test(labels[0]),fileMultiple:el.type==='file'&&el.multiple,fileAccept:el.type==='file'?el.accept:undefined,fileNames:uploadSurface?[...new Set([...uploadSurface.querySelectorAll('.ant-upload-list-item-name,.el-upload-list__item-name,.resumeFileName,[class*="sd-Upload-file-name-"],.file-name,[data-file-name],input.layui-disabled,button.file_upload-btn,.file-uploader__list-view div')].filter(n=>visible(n)&&(!n.closest(".file-uploader__list-view")||(!n.children.length&&/\.(pdf|png|jpe?g)$/i.test(n.textContent.trim())))&&(!n.matches("button.file_upload-btn")||/\.(pdf|docx?|pptx?|wps|jpe?g|png|txt)$/i.test(n.textContent.trim()))).map(n=>String(n.matches("button.file_upload-btn")?n.textContent:n.value??n.textContent).trim()).filter(Boolean))]:undefined,
        componentIndex:components.length>1?components.indexOf(el):undefined,componentCount:components.length>1?components.length:undefined,
        existingText:labels.includes('专业名称')||labels.includes('专业')?String(el.matches('.ant-select')?selectedText(el):el.value||''):undefined,
        endedCheckbox:el.type==='checkbox'&&!el.checked&&el.closest('.phoenix-checkbox')?.textContent.trim()==='至今'&&!![...(phoenixForm?.querySelectorAll('.form-item')||[])].find(f=>f.querySelector('.form-item__title')?.textContent.trim()==='结束时间'&&/^\d{4}-\d{2}/.test(f.querySelector('input')?.value||'')),
        confirmedIdType:(recordIdentity.idType==='身份证'||definition?.querySelector('.slt>span')?.textContent.includes('18位身份证号'))||structuredField?.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()==='身份证'||el.closest('.form-item')?.querySelector('.mobile-type-button .phoenix-button__content')?.textContent.trim()==='身份证',
        elementSelect: !!el.closest('.el-select'), elementDate: !!el.closest('.el-date-editor,.apply-form-date-now'),
        sdMultiple:!!el.closest('[class*="sd-Select-container-"].multi_select_info'),customSelect: !!el.closest('.phoenix-select'), customRadio: el.matches('.phoenix-radio-group'),antSelect:el.matches('.ant-select'),antRadio:el.matches('.ant-radio-group'), invalidDate: el.matches('.phoenix-select') && el.textContent.includes('Invalid date'),
        dateValue: el.closest('.el-date-editor') ? el.value : undefined,
        educationInstruction:!!structuredField&&labels[0]==='教育信息填写说明'&&/完整的教育经历/.test(structuredField.innerText)&&/学历由高至低/.test(structuredField.innerText)&&/确认并开始填写/.test(structuredField.innerText)&&!/隐私|条款|法律|承诺|声明|真实性/.test(structuredField.innerText),instructionChecked:el.type==='checkbox'&&el.checked,
        tag: el.tagName.toLowerCase(), type, role: el.getAttribute('role'), required: !!definitionTitle?.querySelector('font.red')||!!structuredField?.querySelector(':scope > [class*=title-] [class*=required-asterisk-]') || el.required || el.getAttribute('ismustused')==='1' || dictionarySelect?.getAttribute('ismustused')==='1' || /required/.test(el.getAttribute('lay-verify')||el.previousElementSibling?.getAttribute('lay-verify')||'') || !!itemLabel?.querySelector('em') || el.getAttribute('aria-required') === 'true'||!!itemLabel?.matches('.label_required')||!!item?.querySelector('.ant-form-item-required,.el-form-item__label.is-required,.labelRequired,.form-item__required'),
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true'||el.matches('.ant-select-disabled'), readonly: !!el.readOnly,
        dictionaryUnselected:!!dictionarySelect&&!dictionarySelect.value,
        metadataOther:!!metadataName&&el.closest('#container')?.querySelector('h1')?.textContent.trim()==='其他',
        hasValue:definitionHint?false:el.matches('.slt,.dateSlt')?!!observedValue&&!/^(请选择|请输入)/.test(observedValue):dictionarySelect?!!dictionarySelect.value:el.matches('select.citySelect')?!!observedValue:el.matches('.layui-form-select')?!!el.previousElementSibling?.value:nativeRadioGroup?!!checked:el.matches('.ant-select')?!!el.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent.trim():el.matches('.ant-radio-group')?!!el.querySelector('input:checked,.ant-radio-checked'):el.closest('[class*="sd-Select-container-"]') ? !!selectedText(el.closest('[class*="sd-Select-container-"]')) : el.matches('.phoenix-radio-group') ? !!el.querySelector('.phoenix-radio--checked') : el.matches('.phoenix-select') ? !!(el.querySelector('.phoenix-select__tag') || el.querySelector('input')?.value.trim()) : privateType ? false : !!String(el.value ?? el.textContent ?? '').trim() && !/^(请选择|please select|select an option)(?:[.…。\s]*)$/i.test(String(el.value ?? el.textContent ?? '').trim()),
        awardValue: recordIdentity.award ? String(el.querySelector?.('input')?.value ?? el.value ?? '').trim() : undefined,
        options:el.matches('.slt')?[...el.querySelectorAll(':scope >ul>li')].map(o=>({label:o.textContent.trim(),value:o.dataset.code||o.textContent.trim(),disabled:false})):el.tagName==='SELECT'?[...el.options].map(o=>({label:o.textContent.trim(),value:o.value,disabled:o.disabled})):undefined,numericOnlyFilter:/replace\(\s*\/\[\^0-9\]\/g\s*,\s*['"]['"]\s*\)/.test(el.getAttribute('oninput')||''),pattern:el.getAttribute('pattern'),step:el.getAttribute('step'),min:el.getAttribute('min'),
        byteLimit:typeof window.ValidateLength==='function'&&/\.length2\(/.test(String(window.ValidateLength))?Number(el.getAttribute('inputlen'))||null:null,maxLength: el.maxLength > 0 ? el.maxLength : null,
      };
    });
}

function inferSection(headings) {
  for (const text of headings) {
    const exact = sectionFrom(text);
    if (exact) return exact;
    const matches = Object.entries(groups).filter(([, g]) => [g.label, ...g.aliases].some(a => new RegExp(`^${a}(?:[\\s·:：\\-（(\\d]|$)`, 'i').test(text)));
    if (matches.length === 1) return matches[0][0];
  }
  return null;
}

function valueForControl(raw, spec, control) {
  let value = String(Array.isArray(raw)&&new Set(raw).size===1?raw[0]:raw ?? '');
  if (!value) return { reason: '资料中未确认，留空' };
  if(control.numericOnlyFilter&&!/^\d+$/.test(value))return {reason:'页面只允许纯数字，但确认资料包含文字或小数；不能删除字符冒充正确值'};
  if(spec.proficiency&&value==='精通'&&control.options?.length){const best=require('./english-policy.cjs').bestProficiencyOption(control.options);if(best?.reason)return best;if(best?.value)value=best.value;}
  if(control.tag==='input'&&control.type==='text'&&!control.customSelect)value=value.replace(/\r?\n+/g,' ');
  if (spec.date) {
    if (value === '至今') return { reason: '“至今”需要选择网站的在读 / 在职选项' };
    const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return { reason: '日期格式需要人工核对' };
    const dayControl=control.type==='date'||(control.readonly&&/年月日|yyyy[-/]mm[-/]dd/i.test(control.placeholder||''));
    if(dayControl&&!match[3])return {reason:'只有年月，不能为日历控件补造日期'};
    if (control.type === 'month' || (!dayControl&&control.labels.some(t => /yyyy[-/]mm(?![-/]dd)|年月/.test(t.toLowerCase())))) value = value.slice(0, 7);
    else if (control.type === 'text' || control.type === 'input' || control.tag === 'textarea') {
      if (control.labels.some(t => /yyyy\/mm\/dd/i.test(t)) && match[3]) value = value.replaceAll('-', '/');
      else if (control.labels.some(t => /yyyy\/mm/i.test(t))) value = value.slice(0, 7).replace('-', '/');
    }
  }
  if (control.type === 'number' && !/^-?\d+(\.\d+)?$/.test(value)) return { reason: '数值单位或满分口径需确认，未转换原值' };
  if(control.maxLength&&value.length>control.maxLength&&control.tag==='textarea'){
    const unheaded=value.replace(/^(背景与目标|技术实现|测试成果)[：:]\s*/gm,'');
    if(unheaded.length<=control.maxLength)value=unheaded;
  }
  if (control.maxLength && value.length > control.maxLength) return { reason: `原文超过 ${control.maxLength} 字限制，未截断` };
  return { value };
}

function selectOption(options, value, spec) {
  const exact = options.filter(o => !o.disabled && normalize(o.label) === normalize(value));
  if (exact.length === 1) return exact[0];
  const aliases=Array.isArray(spec.optionAliases)?spec.optionAliases:spec.optionAliases?.[value]||[];
  const aliasOptions = options.filter(o=>!o.disabled&&aliases.some(a=>normalize(a)===normalize(o.label)));
  if(aliasOptions.length===1)return aliasOptions[0];
  if(aliasOptions.length>1)return null;
  if(spec.salaryBound){const amount=require('./salary-bounds.cjs').amount,wanted=amount(value);const candidates=options.filter(o=>!o.disabled&&wanted!==null&&amount(o.label)===wanted);return candidates.length===1?candidates[0]:null;}
  if (spec.rank) {
    const rank = String(value).match(/^前(\d+(?:\.\d+)?)%$/);
    if (!rank) return null;
    return options.map(o => ({ ...o, rank: String(o.label).match(/^前\s*(\d+(?:\.\d+)?)\s*%$/) }))
      .filter(o => !o.disabled && o.rank && Number(o.rank[1]) >= Number(rank[1]))
      .sort((a, b) => Number(a.rank[1]) - Number(b.rank[1]))[0] || null;
  }
  return null;
}

// A nonempty control is not proof that it contains the user's confirmed answer.
// Only explicit option equivalents and actual date precision may relax equality.
function valueMatches(control, expected, spec = {}, actual = control.observedValue) {
  if(control.definitionRegion){const canonical=s=>{const parts=String(s||'').split(/[-/]/).map(x=>x.replace(/市/g,''));return normalize(parts.filter((x,i)=>!i||x!==parts[i-1]).join(''));};return !!expected&&canonical(actual)===canonical(control.regionPath?.length?control.regionPath.join('-'):expected);}
  if(spec.salaryRange&&/^\d+$/.test(String(expected))){const m=String(actual||'').match(/(\d+)(?:[-~—](\d+))?/);if(m){const n=Number(expected),low=/以下/.test(actual)?0:Number(m[1]),high=m[2]?Number(m[2]):/以上/.test(actual)?Infinity:Number(m[1]);return n>=low&&n<=high;}}

  if(spec.salaryBound){const amount=require('./salary-bounds.cjs').amount,wanted=amount(expected);return wanted!==null&&wanted===amount(actual);}
  if(control.nativeRegion||control.sdRegion||control.legacyRegion){
    const normalizeRegion=s=>String(s).replace(/市辖区/g,'').replace(/(北京市|天津市|上海市|重庆市)[/,]\1/g,'$1').replace(/[省市\s/,，]/g,'');
    return !!expected&&normalizeRegion(actual)===normalizeRegion(expected);
  }

  if(spec.rank&&/^前\d+(?:\.\d+)?%$/.test(String(expected))&&/^前\d+(?:\.\d+)?%$/.test(String(actual))){const wanted=Number(String(expected).match(/[\d.]+/)[0]),seen=Number(String(actual).match(/[\d.]+/)[0]);if(seen>=wanted&&seen<=100)return true;}
  if(spec.rank&&/^前\d+(?:\.\d+)?%$/.test(String(expected))){const m=String(actual).match(/^(\d+)%[-～~](\d+)%$/),r=Number(String(expected).match(/[\d.]+/)[0]);if(m&&r>+m[1]&&r<=+m[2])return true;}
  if(expected===undefined||expected===null||String(expected)==='')return false;
  const wanted=String(expected),seen=String(actual??'');
  if(control.match?.groupId==='intent'&&control.match?.key==='arrivalDate'&&seen==='三个月以上'&&/^\d{4}-\d{2}-\d{2}$/.test(wanted)){
    const threshold=new Date();threshold.setMonth(threshold.getMonth()+3);threshold.setHours(0,0,0,0);
    return new Date(wanted+'T00:00:00')>threshold;
  }
  if(normalize(seen)===normalize(wanted))return true;
  if(control.placeholder==='请选择专业'&&require('./dictionary-major.cjs').equivalentMajor(seen,wanted))return true;
  const aliases=spec.optionAliases||{};
  const equivalent=Array.isArray(aliases)?aliases:Object.entries(aliases).filter(([key])=>normalize(key)===normalize(wanted)).flatMap(([,values])=>Array.isArray(values)?values:[values]);
  if(equivalent.some(value=>normalize(value)===normalize(seen)))return true;
  if(spec.date){
    if(/^\d{4}-\d{2}\s*\(\d+岁\)$/.test(seen)&&seen.slice(0,7)===wanted.slice(0,7))return true;
    const date=s=>String(s).replaceAll('/','-').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    const a=date(seen),b=date(wanted);
    if(a&&b&&a[1]===b[1]&&a[2]===b[2])return a[3]===b[3]||(!a[3]&&(control.type==='month'||(control.customSelect&&/^\d{4}-\d{2}$/.test(seen))||control.labels.some(t=>/yyyy[-/]mm(?![-/]dd)|年月/i.test(t))));
  }
  return false;
}

function confirmedRecordValue(record,key,origin,url){
  if(['needs-confirmation','unknown','derived-not-user-confirmed'].includes(record.fieldStatus?.[key]))return {reason:'此字段只有推导口径，尚未获本人确认，保留待核对'};
  const overrides=Array.isArray(record.portalOverrides)?record.portalOverrides:[];
  const matches=overrides.filter(entry=>{
    if(!entry||typeof entry!=='object'||typeof entry.origin!=='string'||typeof entry.key!=='string'||entry.key!==key)return false;
    try{const {portalPath}=require('./portal-identity.cjs');return new URL(entry.origin).origin===entry.origin&&entry.origin===origin&&(!entry.path||(url&&new URL(url).origin===origin&&portalPath(origin,new URL(url).pathname)===portalPath(origin,entry.path)));}catch{return false;}
  });
  if(matches.length>1)return {reason:'本站确认的字段口径存在多条记录，请核对后填写'};
  if(matches.length===1){
    if(typeof matches[0].value!=='string'||!matches[0].value.trim())return {reason:'本站确认的字段口径格式无效，请核对后填写'};
    return {value:matches[0].value,portalOverride:true};
  }
  return {value:record[key],portalOverride:false};
}

async function scanPage(page, profile, selections = {}) {
  profile=await require('./record-eligibility.cjs').scopeRequirements(page,require('./section-policy.cjs').scopedProfile(profile,page.url()));
  const controls = [], frameFailures = [];
  for (const [frameIndex, frame] of page.frames().entries()) {
    try {
      if (frame !== page.mainFrame() && !(await (await frame.frameElement()).isVisible())) continue;
      const items = await frame.evaluate(inspectDocument);
      controls.push(...items.map(c => ({ ...c, frame, frameIndex, frameUrl: frame.url() })));
    } catch { frameFailures.push({ label: `页面框架 ${frameIndex + 1}`, status: 'pending', reason: '页面框架无法读取，待页面加载后重试' }); }
  }
  const items = controls.map((control, index) => {
    if(control.educationInstruction)return {...control,id:`field-${index}`,label:control.labels[0],status:control.instructionChecked?'existing':'pending',reason:control.instructionChecked?'普通教育填写顺序说明已通过勾选回读':'教育填写顺序说明尚未确认'};
    if(control.type==='file'&&control.sdTranscript){const levels=control.fileMultiple?['本科','研究生']:[profile.values.basic[0].highestEducation==='硕士研究生'?'研究生':'本科'];const attachments=levels.map(level=>require('./sd-transcripts.cjs').chooseSDTranscript(profile.attachmentCatalog,level,control.fileAccept,page.url()));if(attachments.every(a=>a&&require('./transcript-upload.cjs').authorized(profile,a)&&control.fileNames?.includes(a.filename)))return {...control,id:'field-'+index,label:control.labels[0],verifiedSDAttachmentNames:attachments.map(a=>a.filename),status:'existing',reason:'对应学历成绩单原件均已上传并回读；保存状态另行核验'};}
    if(control.type==='file'){const level=({'硕士研究生':'研究生','硕士':'研究生','本科':'本科'})[control.recordIdentity?.level];const attachment=require('./transcript-upload.cjs').chooseTranscript(profile.attachmentCatalog,level,'');if(attachment&&require('./transcript-upload.cjs').authorized(profile,attachment)&&control.fileNames?.includes(attachment.filename))return {...control,id:`field-${index}`,label:control.labels[0]||'成绩单',verifiedAttachmentName:attachment.filename,status:'existing',reason:'已显示对应学历的已确认成绩单原件；保存状态另行核验'};}
    if(control.type==='file')return {...control,id:`field-${index}`,label:control.labels[0]||'附件上传',status:'pending',reason:control.fileNames?.length?'页面显示附件文件名，须单独核验真实文件及上传结果；未自动上传':'附件上传入口尚未核验，须检查所需真实文件；未自动上传'};
    if(control.headings.includes('论文/专著') && profile.noPublications) return {...control,id:`field-${index}`,label:control.labels[0]||'论文/专著',status:'notApplicable',reason:'本人确认无论文专著，本栏不适用，不填写'};
    let section = inferSection(control.headings.slice(0,1));
    if(!section&&control.metadataOther)section='additional';
    if(profile.ignoredSections?.includes(section))return {...control,id:`field-${index}`,label:control.labels[0]||'未标注字段',section,status:'notApplicable',reason:'本人确认此页面不填写该栏目，保留其他网站适配'};
    if(control.headings[0]==='工作经历'&&controls.some(c=>c.headings[0]==='实习经历'))return {...control,id:'field-'+index,label:control.labels[0]||'未标注字段',section:'formalEmployment',value:control.observedValue,status:control.hasValue?'existing':control.required&&/是否/.test(control.labels[0])?'pending':'notApplicable',reason:'网站独立区分正式工作与实习，此处不套用实习记录'};
    if(control.headings.includes('在校实践')){
      if(controls.some(c=>c.headings.includes('项目经历')))return {...control,id:`field-${index}`,label:control.labels[0],status:control.hasValue?'pending':'notApplicable',reason:'独立在校实践栏目不套用科研项目；项目仅填写项目经历'};
      section='projects';
    }
    if (control.headings.some(h => /^(在校实践|论文\/专著)$/.test(h)) && section!=='projects') return { ...control, id: `field-${index}`, label: control.labels[0] || '未标注字段', status: control.hasValue ? 'existing' : 'pending', reason: '此栏目尚未建立确定的资料映射，保留已有内容' };
    if(control.type==='checkbox'&&control.structuredRecord&&control.labels[0]==='起止时间'&&!control.instructionChecked){
      const identity=control.recordIdentity||{};
      const records=section==='internship'?(profile.values.internship||[]).filter(r=>normalize(r.company)===normalize(identity.company)):section==='projects'?(profile.values.projects||[]).filter(r=>normalize(r.name.split('｜')[0])===normalize((identity.project||'').split('｜')[0])):[];
      if(records.length===1&&/^\d{4}-\d{2}/.test(records[0].endTime||''))return {...control,id:`field-${index}`,label:'至今',status:'notApplicable',reason:'对应知识库经历已有结束日期，至今保持未勾选'};
    }
    if(control.employmentChoice)return {...control,id:`field-${index}`,label:control.labels[0],status:control.instructionChecked?'existing':control.employmentGroupChecked?'notApplicable':'pending',reason:control.instructionChecked?'已选择的工作性质已回读，保留现有选择':control.employmentGroupChecked?'该工作性质未选，保留已有选择':'工作性质尚未选择，需按当前岗位确认'};
    if(control.type==='checkbox'&&!control.ongoingCheckbox&&!control.endedCheckbox)return {...control,id:`field-${index}`,label:control.labels[0]||'未标注字段',status:'pending',reason:'确认、声明及简历同步选项由本人核验，未自动勾选'};
    if(!section&&control.headings.length)return {...control,id:`field-${index}`,label:control.labels[0]||'未标注字段',status:'pending',reason:'当前栏目尚未建立确定的资料映射，禁止跨栏目套用字段'};
    const learned = learnedMatch(profile.learnedFields || [], page.url(), control);
    let match = learned && (!section || learned.groupId === section) ? learned : matchField(control.labels, section);
    if(match?.groupId==='education'&&match.key==='classRank'&&control.labels[0]==='专业排名'&&controls.some(c=>c.block===control.block&&c.labels[0]==='班级排名'))match={groupId:'education',key:'professionalRank',spec:require('./rules.cjs').groups.education.fields.professionalRank};
    if(!match&&section==='additional'&&control.labels[0]==='自我评价')match=matchField(control.labels,'evaluation');
    if(!match&&section==='additional'&&/^是否接受(?:岗位)?调剂$/.test(control.labels[0]))match=matchField(control.labels,'intent');
    if(!match&&section==='basic')match=matchField(control.labels,'intent');
    if(!match&&section==='education'&&control.labels[0]==='最高学历')match=matchField(control.labels,'basic');
    if(!match&&/^(?:了解.+的途径|你通过什么渠道了解.+)$/.test(control.labels[0]||''))match=matchField(['了解该招聘信息渠道'],'intent');
    const item = { ...control, id: `field-${index}`, label: control.labels[0] || '未标注字段', section, match, status: 'pending' };
    if(section==='intent'&&profile.workflow?.fill_optional_intent===false&&!control.required&&!control.hasValue)return {...item,status:'notApplicable',reason:'本人要求求职意向非必填空项不主动填写'};
    if(match?.groupId==='projects' && control.recordIdentity?.project){
      const found=(profile.values.projects||[]).map((r,i)=>({r,i})).filter(({r})=>require('./project-identity.cjs').projectMatches(r,control.recordIdentity.project));
      if(found.length!==1)return {...item,reason:'实践名称不能唯一对应项目，请先核对'};
      item.recordIndex=found[0].i;
    }
    if (match?.groupId === 'awards' && control.recordIdentity?.award) {
      const found = (profile.values.awards||[]).map((r,i)=>({r,i})).filter(({r})=>[r.name,...(r.aliases||[])].some(n=>normalize(n)===normalize(control.recordIdentity.award)));
      if(found.length!==1) return {...item,reason:'奖项名称无法唯一匹配，可能混入多项奖励；需拆分核对，不能按顺序填写'};
      item.recordIndex=found[0].i;
    }
    if(control.ongoingCheckbox&&control.ongoingSelected&&section==='campus'&&(profile.values.campus||[]).some(r=>require('./campus-identity.cjs').campusMatches(r.name,control.recordIdentity.campus)&&r.endTime==='至今'))return {...item,label:'至今',ongoingConfirmed:true,status:'existing',reason:'已核验对应学生经历持续至今'};
    if(control.endedCheckbox)return {...item,label:'至今',status:'notApplicable',reason:'本条已有结束时间，至今保持未勾选'};
    if (/password|file|checkbox|radio/.test(control.type)) return { ...item, reason: '登录、附件和确认选项由本人操作' };
    if (!match) return { ...item, reason: '名称不明确或属于多个栏目，需要补充映射' };
    const invalidDate = match.spec.date && control.invalidDate;
    const records = profile.values[match.groupId] || [];
    let recordIndex = item.recordIndex ?? selections[match.groupId] ?? 0;
    if(match.groupId==='practices'){
      const text=normalize(control.metadataRecordDescription);
      const found=records.map((r,i)=>({r,i})).filter(({r})=>text&&((normalize(r.description).length>100&&text.includes(normalize(r.description)))||text.startsWith(normalize(r.name.split('｜')[0]))));
      if(found.length!==1)return {...item,reason:'实践描述无法唯一对应知识库，保留原值待核对'};
      recordIndex=found[0].i;
    }
    if (match.groupId === 'awards' && control.recordIdentity?.award) {
      const found = records.map((r,i)=>({r,i})).filter(({r})=>[r.name,...(r.aliases||[])].some(n=>normalize(n)===normalize(control.recordIdentity.award)));
      if (found.length !== 1) return {...item,reason:'已有奖项名称不能唯一匹配知识库，需核对后补填'};
      recordIndex = found[0].i;
    }
    if(match.groupId==='languages'&&control.recordIdentity?.languageExam){const aliases={IELTS:'雅思',CET6:'大学英语六级',CET4:'大学英语四级'};const exam=aliases[control.recordIdentity.languageExam]||control.recordIdentity.languageExam;const found=records.map((r,i)=>({r,i})).filter(({r})=>normalize(r.name)===normalize(exam));if(found.length!==1)return {...item,reason:'语言考试不能唯一对应已确认成绩，未按顺序套用'};recordIndex=found[0].i;}
    if (match.groupId === 'education') {
      if (control.recordIdentity?.school || control.recordIdentity?.level) {
        const identity = control.recordIdentity;
        let matches = records.map((r,i) => ({r,i})).filter(({r}) => (!identity.school || normalize(r.school) === normalize(identity.school)) && (!identity.level || normalize(r.level) === normalize(identity.level)));
        if(matches.length>1&&identity.major)matches=matches.filter(({r})=>require('./education-identity.cjs').sameMajor(r.major,identity.major));
        if (matches.length !== 1) return { ...item, reason: '页面学校与学历不能唯一对应知识库，请核对经历' };
        recordIndex = matches[0].i;
      }
      if(!control.recordIdentity?.school&&!control.recordIdentity?.level){
        const h = control.headings.join(' ');
        const levels = records.map((r, i) => ({ i, level: r.level })).filter(r => h.includes(r.level) || (/硕士/.test(r.level) && /硕士/.test(h)));
        if (levels.length === 1) recordIndex = levels[0].i;
      }
    }
    if(match.groupId==='family'){
      const identity=control.recordIdentity||{};
      if(!identity.name&&!identity.relation)return {...item,reason:'尚未确定本条家庭成员身份，先选择姓名或关系，不能套用本人工作经历'};
      const found=records.map((r,i)=>({r,i})).filter(({r})=>(!identity.name||normalize(r.name)===normalize(identity.name))&&(!identity.relation||normalize(r.relation)===normalize(identity.relation)));
      if(found.length!==1)return {...item,reason:'家庭成员姓名与关系不能唯一匹配知识库，请核对'};
      recordIndex=found[0].i;
    }
    if(match.groupId==='campus'&&control.recordIdentity?.campus){const found=records.map((r,i)=>({r,i})).filter(({r})=>require('./campus-identity.cjs').campusMatches(r.name,control.recordIdentity.campus));if(found.length!==1)return {...item,reason:'学生经历身份不唯一'};recordIndex=found[0].i;}
    if(match.groupId==='skills'&&control.recordIdentity?.skillName){
      const found=records.map((r,i)=>({r,i})).filter(({r})=>[r.name,...(groups.skills.fields.name.optionAliases?.[r.name]||[])].some(n=>normalize(n)===normalize(control.recordIdentity.skillName)));
      if(found.length!==1)return {...item,reason:'技能名称不能唯一匹配知识库，请核对'};
      recordIndex=found[0].i;
    }
    if(match.groupId==='internship'&&control.recordIdentity?.company){
      const found=records.map((r,i)=>({r,i})).filter(({r})=>normalize(r.company)===normalize(control.recordIdentity.company));
      if(found.length!==1)return {...item,reason:'实习公司不能唯一匹配知识库，请核对'};
      recordIndex=found[0].i;
    }
    if(match.groupId==='internship'&&control.phoenixCompanyField&&!control.recordIdentity?.company)return {...item,reason:'工作记录尚无公司身份，不能把有其他内容的记录按序套成实习'};
    const record = records[recordIndex];
    if(record?.[match.key]==='至今'&&control.ongoingSelected&&match.key==='endTime')return {...item,recordIndex,ongoingConfirmed:true,status:'existing',reason:'已核验至今选项，结束日期留空'};
    item.recordIndex=recordIndex;
    if (!record) return { ...item, reason: '所选经历不存在，请刷新资料' };
    item.regionPath=record[match.key+'Path'];
    const confirmed=confirmedRecordValue(record,match.key,new URL(page.url()).origin,page.url());
    if(match.groupId==='education'&&['classRank','professionalRank'].includes(match.key)&&record[match.key+'Exact']&&control.rankPlainText&&(!control.options?.length))confirmed.value=record[match.key+'Exact'];
    if(control.structuredRecord&&match.groupId==='awards'&&match.key==='name'&&record.fullName)confirmed.value=record.fullName;
    if(confirmed.reason)return {...item,reason:confirmed.reason};
    item.portalOverride=confirmed.portalOverride;
    let policyOverwrite=(!!control.phoenixRecord||!!control.structuredRecord)&&!!(control.recordIdentity?.company||control.recordIdentity?.project||control.recordIdentity?.level||control.recordIdentity?.campus||['basic','intent'].includes(match.groupId))&&require('./phoenix-record-repair.cjs').overwriteConfirmed(profile,page.url(),match.groupId,match.key);
    if(match.groupId==='education'&&match.key==='major'&&require('./education-identity.cjs').canRepairParsedMajor(record,control))policyOverwrite=true;
    if(profile.englishExamPolicy&&['englishLevel','englishScore'].includes(match.key)){const peers=controls.filter(c=>c.frame===control.frame&&c.block===control.block);const level=peers.find(c=>matchField(c.labels,section)?.key==='englishLevel'),score=peers.find(c=>matchField(c.labels,section)?.key==='englishScore');const pair=require('./english-policy.cjs').chooseEnglishPair(control.metadataTier!==undefined?control:level,(profile.recordRepairs||[]).some(r=>require('./phoenix-record-repair.cjs').scopeMatches(r,page.url())&&(r.integerFields||[]).includes('basic.englishScore'))?{...score,pattern:'[0-9]+'}:score,profile.englishExamPolicy);confirmed.value=match.key==='englishLevel'?pair.level:pair.score;policyOverwrite=true;}
    if(match.groupId==='languages'&&record.language==='英语'&&record.proficiency==='精通'&&['proficiency','listeningSpeaking','readingWriting'].includes(match.key))policyOverwrite=true;
    if(profile.skillProficiencyPolicy&&match.groupId==='skills'&&match.key==='level'){confirmed.value=profile.skillProficiencyPolicy.level;policyOverwrite=true;}
    if(control.metadataTier!==undefined&&['hukouLocation','currentAddress'].includes(match.key)&&control.options?.length){const text=String(Array.isArray(confirmed.value)?confirmed.value[control.metadataTier]||confirmed.value[0]:confirmed.value);const equivalents=control.options.filter(o=>o.value&&o.value!=='0'&&text.startsWith(o.label.replace(/市$/,'')));if(equivalents.length===1)confirmed.value=equivalents[0].label;}
    if(profile.adjustmentPolicy?.status==='user-confirmed'&&['basic','intent'].includes(match.groupId)&&['acceptAdjustment','acceptLocationAdjustment'].includes(match.key))policyOverwrite=true;
    for(const t of profile.fieldTransforms||[])if(t.status==='verified'&&t.field===match.groupId+'.'+match.key&&(!t.recordName||t.recordName===record.name)&&new URL(page.url()).origin===t.origin&&(!t.path||new URL(page.url()).pathname===t.path)){confirmed.value=require('./text-formatting.cjs').formatConfirmedText(confirmed.value,t.mode,t);policyOverwrite=true;}
    item.policyOverwrite=policyOverwrite;
    const short=record[match.key+'Short'];const length=v=>control.byteLimit?String(v||'').replace(/[^\x00-\xff]/g,'aa').length:String(v||'').length;const limit=control.byteLimit||control.maxLength;if(limit&&length(confirmed.value)>limit&&short&&length(short)<=limit)confirmed.value=short;
    let transformed = control.datePart&&/^\d{4}-\d{2}/.test(String(confirmed.value||''))?{value:control.datePart==='year'?String(confirmed.value).slice(0,4):String(Number(String(confirmed.value).slice(5,7)))}:valueForControl(confirmed.value, match.spec, control);
    if(match.groupId==='awards'&&match.key==='scope'&&new URL(page.url()).hostname==='stics.zhiye.com'&&transformed.value)transformed.value=({'省部级':'省区级','学校级':'院校级'})[transformed.value]||transformed.value;
    if(control.componentCount>1){
      const paths=[confirmed.value,record[`${match.key}Path`],record[`${match.key}FullPath`]].filter(path=>Array.isArray(path)&&path.length===control.componentCount);
      const uniquePaths=[...new Map(paths.map(path=>[JSON.stringify(path),path])).values()];
      const path=uniquePaths.length===1?uniquePaths[0]:null;
      if(!path||!path[control.componentIndex])return {...item,reason:uniquePaths.length>1?'同一字段存在相互冲突的级联路径，需核对':'同一字段包含多个级联控件，需要按已确认的省市路径分别匹配',status:'pending'};
      transformed=valueForControl(path[control.componentIndex],match.spec,control);
    }
    // Compare the same final narrative we will write. Adding the role only after
    // comparison made a correct description look stale on every subsequent run.
    if(match.groupId==='projects'&&match.key==='description'&&transformed.value&&record.role){
      const hasRole=controls.some(other=>other.frame===control.frame&&other.block===control.block&&matchField(other.labels,'projects')?.key==='role');
      if(!hasRole&&!transformed.value.startsWith(record.role))transformed.value=`${record.role}\n${transformed.value}`;
    }
    if(control.hasValue&&!invalidDate){
      const expected=transformed.value;
      if(policyOverwrite&&match.groupId==='education'&&match.key==='major'&&control.observedValue!==confirmed.value)return {...item,...transformed,status:'ready',reason:'按确认专业全称修复解析缺失'};
      if(control.sdMultiple&&match.spec.multiple&&expected){const want=expected.split(/[,、]/).filter(Boolean),have=control.observedValue.split(/[,、]/).filter(Boolean);if(have.length<want.length&&have.every(v=>want.includes(v)))return {...item,...transformed,policyOverwrite:true,status:'ready',reason:'多选已有标签是确认目标的子集，仅补充缺失选项'};}
      if(valueMatches(item,expected,match.spec))return {...item,...transformed,status:'existing',reason:'已有内容与已确认知识库一致'};
      if(policyOverwrite&&expected)return {...item,...transformed,status:'ready',reason:'按本人最新确认规则更新此字段'};
      return {...item,status:'pending',reason:expected?'已有内容与已确认知识库不一致，保留原值待核对':'已有内容尚无确认资料可供核对，保留原值'};
    }
    if(control.disabled)return {...item,reason:'控件尚未启用，可能依赖上一个选项'};
    if (match.spec.manual && !(match.key==='idNumber'&&control.confirmedIdType&&profile.values.basic[0].idNumber)) return { ...item, reason: '此字段需按网站语义核对，可从左侧复制' };
    return { ...item, recordIndex, regionPath: record[match.key+'Path'], ...transformed, status: transformed.reason ? 'pending' : 'ready' };
  });
  // Multiple entries must never receive the same experience by index guessing.
  const duplicates = new Map();
  for (const item of items.filter(i => i.match)) {
    if (item.match.groupId === 'education' && item.recordIndex === undefined && item.recordIdentity?.school) {
      const matches = (profile.values.education || []).map((r,i)=>({r,i})).filter(({r})=>normalize(r.school)===normalize(item.recordIdentity.school) && (!item.recordIdentity.level || normalize(r.level)===normalize(item.recordIdentity.level)));
      if (matches.length === 1) item.recordIndex = matches[0].i;
    }
    const key = `${item.match.groupId}:${item.recordIndex ?? selections[item.match.groupId] ?? 0}:${item.match.key}:${item.datePart||''}:${item.componentIndex??''}:${item.metadataTier??''}`;
    duplicates.set(key, [...(duplicates.get(key) || []), item]);
  }
  for (const list of duplicates.values()) if (list.length > 1) for (const item of list) {
    if (item.status === 'ready') { item.status = 'pending'; item.reason = '同栏目有多个相同字段，请只展开要填写的一条经历'; }
  }
  // Two identity fields in one undivided record container leave every dependent
  // field ambiguous, even if a date or description happens to appear only once.
  const identityKeys={education:'school',internship:'company',projects:'name',campus:'name',awards:'name',family:'name',skills:'name',languages:'name'};
  const identityScopes=new Map();
  const recordScope=item=>`${item.frameIndex}:${item.match?.groupId}:${item.block||item.sectionBlock||'unscoped'}:${item.qualificationLevel||''}`;
  for(const item of items.filter(i=>i.match&&identityKeys[i.match.groupId]===i.match.key)){
    const key=recordScope(item);identityScopes.set(key,[...(identityScopes.get(key)||[]),item]);
  }
  const ambiguousScopes=new Set([...identityScopes.entries()].filter(([,identityFields])=>identityFields.length>1).map(([key])=>key));
  for(const item of items){
    if(item.match&&ambiguousScopes.has(recordScope(item))&&['ready','existing'].includes(item.status)){
      item.status='pending';item.reason='同一记录容器有多个相同身份字段，无法确定本字段属于哪条经历，未按默认顺序填写';
    }
  }
  for (const item of items) {
    if (item.status === 'ready' && item.match.groupId === 'projects' && item.match.key === 'description') {
      const role = profile.values.projects[item.recordIndex].role;
      const hasRole = items.some(other => other.match?.groupId === 'projects' && other.match.key === 'role' && other.block === item.block && other.frame === item.frame);
      if (role && !hasRole && !item.value.startsWith(role)) {
        item.value = `${role}\n${item.value}`;
        if (item.maxLength && item.value.length > item.maxLength) { item.status = 'pending'; item.reason = '包含项目角色后超过字数限制，未截断'; }
      }
    }
  }
  return { url: page.url(), items, frameFailures };
}

function report(scan, elapsedMs = 0) {
  const fields = [...scan.items.map(i => ({ id: i.id, label: i.label, group: i.type==='file'?'附件':i.match ? groups[i.match.groupId].label : '未识别',
    status: i.status, reason: i.reason || '', controlType:i.controlType, attempts:i.attempts, required: i.required, durationMs: i.durationMs,
    fileNames:i.fileNames,portalOverride:i.portalOverride||undefined,
    fieldPath: i.match ? `${i.match.groupId}.${i.recordIndex ?? 0}.${i.match.key}` : undefined,
  })), ...scan.frameFailures];
  return { fields, elapsedMs,addedRecords:scan.addedRecords||[], counts: Object.fromEntries(['filled', 'ready', 'pending', 'existing', 'failed','notApplicable'].map(s => [s, fields.filter(f => f.status === s).length])) };
}

async function fillSinglePage(page, profile, selections, cancelled = () => false, progress = () => {}) {
  profile=await require('./record-eligibility.cjs').scopeRequirements(page,require('./section-policy.cjs').scopedProfile(profile,page.url()));
  // Preview can cover an opacity-hidden editor that Playwright still calls visible.
  // Keep the whole fill operation read-only once the preview surface is shown.
  const previewSurface=page.locator('.apply-form-preview');
  if(await previewSurface.count()===1&&await previewSurface.isVisible())return report(await scanPage(page,profile,selections));
  if(await require('./login-barrier.cjs').loginBarrier(page))return report({url:page.url(),items:[],frameFailures:[{label:'登录验证',status:'pending',reason:'当前验证码登录弹窗遮挡表单，请本人登录后重试；未操作登录或同意条款'}]});
  await require('./instruction-checkbox.cjs').acknowledgeInstructions(page,cancelled);
  await require('./metadata-records.cjs').ensureMetadataSkills(page,profile,cancelled);
  const currentJob=await require('./job-context.cjs').readContext(page).catch(()=>({}));
  if(currentJob?.role&&profile.values.intent?.length===1)profile={...profile,values:{...profile.values,intent:[{...profile.values.intent[0],appliedRole:currentJob.role}]}};
  if(await require('./feishu-resume.cjs').isFeishuResume(page))return require('./feishu-resume.cjs').fillFeishuResume(page,profile,cancelled);
  if(require('./alibaba-resume.cjs').isAlibaba(page))return require('./alibaba-resume.cjs').fillAlibaba(page,profile,cancelled);
  if(require('./phytium-resume.cjs').isPhytium(page))return require('./phytium-resume.cjs').fillPhytium(page,profile,cancelled);
  const verifiedScrd=require('./zhaopin-verified.cjs').loadPlan(page,profile);
  if(verifiedScrd)return require('./zhaopin-verified.cjs').fillVerified(page,profile,verifiedScrd,cancelled);
  if(require('./zhaopin.cjs').isZhaopin(page)&&String(profile.zhaopin?.save_authorized_company_id)===new URL(page.url()).searchParams.get('cid'))return require('./zhaopin.cjs').fillZhaopin(page,profile,cancelled);
  if(require('./qiyuan.cjs').isQiyuan(page))return require('./qiyuan.cjs').fillQiyuan(page,profile,cancelled);
  if(require('./aircas.cjs').isAircas(page))return require('./aircas.cjs').fillAircas(page,profile,cancelled);
  if(require('./wjx.cjs').isWjx(page))return require('./wjx.cjs').fillWjx(page,profile,cancelled);
  const redseaReviewed=require('./redsea-reviewed.cjs').loadPlan(page);
  if(redseaReviewed)return require('./redsea-reviewed.cjs').fillReviewed(page,redseaReviewed,cancelled);
  const moseekerReviewed=require('./moseeker-reviewed.cjs').loadPlan(page);
  if(moseekerReviewed)return require('./moseeker-reviewed.cjs').fill(page,moseekerReviewed,cancelled);
  const started = Date.now();
  const educationFailures=[];
  try{await require('./sd-reviewed-fields.cjs').prepare(page,profile,cancelled);}catch(e){educationFailures.push({label:'SD已核验字段补漏',status:'pending',reason:e.message});}
  let repairedRecords=[];
  try{repairedRecords=await require('./phoenix-record-repair.cjs').repairPhoenixRecords(page,profile,cancelled);}catch(e){educationFailures.push({label:'已确认解析纠错',status:'pending',reason:e.message});}
  try{await require('./phoenix-internship.cjs').ensurePhoenixInternship(page,profile,cancelled,repairedRecords.some(r=>r.group==='internship'));}catch(e){educationFailures.push({label:'实习工作经历记录',status:'pending',reason:e.message});}
  try{await require('./phoenix-family.cjs').ensurePhoenixFamily(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增家庭成员',status:'pending',reason:e.message});}
  try{await require('./phoenix-campus.cjs').ensurePhoenixCampus(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增学生经历',status:'pending',reason:e.message});}
  try{await require('./crsc-resume.cjs').prepare(page,profile,cancelled);}catch(e){educationFailures.push({label:'中国通号栏目补全',status:'pending',reason:e.message});}
  try{await require('./phoenix-verified-fields.cjs').prepare(page,profile,cancelled);}catch(e){educationFailures.push({label:'已核验字段补漏',status:'pending',reason:e.message});}
  try{await require('./structured-education.cjs').ensureEducation(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增教育经历',status:'pending',reason:e.message});}
  try{const attachments=await require('./transcript-upload.cjs').ensurePhoenixTranscripts(page,profile,cancelled);educationFailures.push(...attachments.filter(a=>a.status==='pending'));}catch(e){educationFailures.push({label:'成绩单上传',status:'pending',reason:e.message});}
  try{await require('./sd-transcripts.cjs').ensureSDTranscripts(page,profile,cancelled);}catch(e){educationFailures.push({label:'成绩单上传',status:'pending',reason:e.message});}
  let addition;
  try{addition=await ensureProjects(page,profile,cancelled);}catch(e){addition={added:[],pending:[e.message]};}
  let awards;
  try{awards=await ensureAwards(page,profile,cancelled);}catch(e){awards={pending:[e.message]};}
  let cellRecords;
  try{cellRecords=await require('./form-cell-records.cjs').ensureFormCellRecords(page,profile,cancelled);}catch(e){cellRecords={added:[],pending:[e.message]};}
  try{await require('./form-cell-verified.cjs').prepare(page,profile,cancelled);}catch(e){cellRecords.pending.push('已核验字段恢复：'+e.message);}
  let scan = await scanPage(page, profile, selections);
  try{await require('./sd-records.cjs').ensureSDRecords(page,profile,cancelled);scan=await scanPage(page,profile,selections);}catch(e){scan.frameFailures.push({label:'新增结构化记录',status:'pending',reason:e.message});}
  scan.addedRecords=cellRecords.added;
  scan.frameFailures.push(...educationFailures);
  for(const reason of addition.pending)scan.frameFailures.push({label:'新增项目',status:'pending',reason});
  for(const reason of awards.pending)scan.frameFailures.push({label:'新增奖项',status:'pending',reason});
  for(const reason of cellRecords.pending)scan.frameFailures.push({label:'新增重复记录',status:'pending',reason});
  const workflowFailures=[...scan.frameFailures];
  const attempted=new Map(),completed=new Map();
  const controlKey=item=>`${item.frameIndex}:${item.selector}`;
  for(let pass=0;pass<3;pass++){
  let madeProgress=0;
  for (const item of scan.items) {
    if (item.status !== 'ready') continue;
    if(await require('./login-barrier.cjs').loginBarrier(page)){educationFailures.push({label:'登录验证',status:'pending',reason:'填写期间出现验证码登录弹窗，已停止后续操作，请本人登录'});break;}
    const key=controlKey(item);
    const previous=attempted.get(key);
    if(previous&&previous.value===item.value){item.status=previous.status;item.reason=previous.reason;item.controlType=previous.controlType;item.attempts=previous.attempts;continue;}
    const start = Date.now();
    try {
      if (cancelled() || page.url() !== scan.url) { item.status = 'pending'; item.reason = '已停止或页面已切换'; continue; }
      if (item.frame.url() !== item.frameUrl) throw new Error('FRAME_CHANGED');
      const locator = item.frame.locator(item.selector);
      if (await locator.count() !== 1 || (!await locator.isVisible()&&!(item.nativeRadioGroup&&await locator.locator('input[type=radio]').first().isVisible()))) throw new Error('CHANGED');
      const current = await locator.evaluate(el => ({ value: String(el.value ?? el.textContent ?? '').trim(), tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || el.tagName.toLowerCase(), readonly: !!el.readOnly, name: el.getAttribute('name') }));
      current.value = await locator.evaluate(controlValue);
      if (current.tag !== item.tag || current.type !== item.type || (current.name && !item.labels.includes(current.name))) throw new Error('CHANGED');
      if (current.value && !item.dictionaryUnselected && !item.policyOverwrite && !(item.datePart && !item.hasValue) && !/^(请选择|please select|select an option)(?:[.…。\s]*)$/i.test(current.value) && !(item.match.spec.date && current.value==='Invalid date')) {
        item.status=valueMatches(item,item.value,item.match.spec,current.value)?'existing':'pending';item.reason=item.status==='existing'?'页面新带入内容与知识库一致':'页面新带入内容与知识库不一致，保留待核对';continue;
      }
      const result=await executeControl(item.frame,locator,{...item,cancelled,allowOverwrite:!!item.dictionaryUnselected||!!item.policyOverwrite||(!!item.datePart&&!item.hasValue)});
      item.expected=result.value;item.controlType=result.controlType;item.attempts=result.attempts;
      const valid = await locator.evaluate(el => !el.validity || el.validity.valid);
      if (!valid) throw new Error('INVALID');
      item.status = 'filled'; item.reason = '已填写并回读；尚未核验保存';
      completed.set(key,item);madeProgress++;
    } catch (e) {
      const messages = { DATE_PRECISION: '知识库只有年月，网页要求具体日，未补造日期', OPTION: '未找到唯一匹配选项，留给手动或 AI 补漏', CALENDAR: '只读日期控件需要网站适配，未强写值',
        VERIFY: '回读值与预期不一致，需要检查', INVALID: '网站字段校验未通过', CHANGED: '页面结构已变化，请重新检查', FRAME_CHANGED: '页面框架已切换，请重新检查' };
      item.status = 'pending'; item.controlType=e.controlType;item.attempts=e.attempts;item.reason = messages[e.code||e.message] || e.message || '短超时内无法操作，未反复重试';
    }
    item.durationMs = Date.now() - start;
    attempted.set(key,{value:item.value,status:item.status,reason:item.reason,controlType:item.controlType,attempts:item.attempts});
    progress(report(scan, Date.now() - started));
  }
  if(cancelled()||page.url()!==scan.url||!madeProgress)break;
  // Re-read controls enabled/created by parent choices. Do not retry unchanged failures.
  // A final scan also catches parent callbacks that cleared previously filled fields.
  scan=await scanPage(page,profile,selections);
  scan.addedRecords=cellRecords.added;
  scan.frameFailures.push(...workflowFailures);
  for(const item of scan.items){
    const done=completed.get(controlKey(item));
    if(done){
      try{
        const actual=await item.frame.locator(item.selector).evaluate(controlValue);
        if(actual===done.expected){Object.assign(item,{status:'filled',reason:done.reason,expected:done.expected,controlType:done.controlType,attempts:done.attempts,durationMs:done.durationMs});}
        else{completed.delete(controlKey(item));item.status='pending';item.reason='后续页面变化影响了此字段，请重新核对';attempted.set(controlKey(item),{value:item.value,status:item.status,reason:item.reason});}
      }catch{completed.delete(controlKey(item));item.status='pending';item.reason='后续页面变化影响了此字段，请重新核对';attempted.set(controlKey(item),{value:item.value,status:item.status,reason:item.reason});}
    }else{
      const previous=attempted.get(controlKey(item));
      if(previous&&previous.value===item.value&&item.status==='ready')Object.assign(item,{status:previous.status,reason:previous.reason,controlType:previous.controlType,attempts:previous.attempts});
    }
  }
  if(!scan.items.some(item=>item.status==='ready'))break;
  }
  // Catch parent selectors / parser callbacks clearing previously filled values.
  for (const item of scan.items.filter(i => i.status === 'filled')) {
    if(cancelled()){item.status='pending';item.reason='已停止，尚未完成最终回读';continue;}
    try {
      if (page.url() !== scan.url || item.frame.url() !== item.frameUrl) throw new Error('changed');
      const actual = await item.frame.locator(item.selector).evaluate(controlValue);
      if (actual !== item.expected) throw new Error('changed');
    } catch { item.status = 'pending'; item.reason = '后续页面变化影响了此字段，请重新核对'; }
  }
  // Existing is a claim about the current DOM value, never about saved server state.
  // Re-read at the end because later dependency callbacks can change untouched fields too.
  for(const item of scan.items.filter(i=>i.status==='existing')){
    if(cancelled()){item.status='pending';item.reason='已停止，尚未完成最终回读';continue;}
    try{
      if(page.url()!==scan.url||item.frame.url()!==item.frameUrl)throw new Error('changed');
      const locator=item.frame.locator(item.selector);
      if(item.verifiedSDAttachmentNames){if(!await locator.evaluate(require('./sd-transcripts.cjs').sdUploadsReady,item.verifiedSDAttachmentNames))throw Error('changed');continue;}
      if(item.verifiedAttachmentName){if(!await locator.evaluate((el,name)=>el.closest('.file-uploader__wrapper')?.querySelector('.file-uploader__list-view')?.innerText.split('\n').map(s=>s.trim()).includes(name),item.verifiedAttachmentName))throw Error('changed');continue;}
      if(item.educationInstruction){if(!await locator.isChecked())throw Error('changed');continue;}
      if(item.employmentChoice){if(!await locator.isChecked())throw Error('changed');continue;}
      if(item.ongoingConfirmed){if(!await locator.evaluate(el=>!!el.closest('.ux-standard-form')?.querySelector('input[type=checkbox]:checked')))throw Error('changed');continue;}
      const actual=item.tag==='select'&&!item.nativeRegion?await locator.evaluate(el=>el.selectedOptions[0]?.textContent.trim()||''):await locator.evaluate(controlValue);
      if(!valueMatches(item,item.value,item.match?.spec,actual)||!await locator.evaluate(el=>!el.validity||el.validity.valid))throw new Error('changed');
    }catch{item.status='pending';item.reason='已有内容在最终回读时未能确认与知识库一致，请核对';}
  }
  return report(scan, Date.now() - started);
}
async function fillPage(page,profile,selections={},cancelled=()=>false,progress=()=>{}){
 return require('./saved-page-flow.cjs').runSavedPageFlow(page,profile,selections,cancelled,progress,fillSinglePage);
}
module.exports = { inspectDocument, inferSection, scanPage, fillPage, report, valueForControl, selectOption, valueMatches,confirmedRecordValue };




