const {executeControl}=require('./control-dispatcher.cjs');


const { groups, normalize, sectionFrom, matchField } = require('./rules.cjs');
const { learnedMatch } = require('./learned-fields.cjs');


const { controlValue } = require('./control-value.cjs');
const { ensureProjects } = require('./add-projects.cjs');
const { ensureAwards } = require('./add-awards.cjs');

// Read-only frame scan. Local values establish record identity and verify confirmed answers.
function inspectDocument() {
  const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const labelText = node => { const clone = node.cloneNode(true); clone.querySelectorAll('input,textarea,select,button,[role="combobox"],.labelRequired,.remarkShow,[role="tooltip"],.anticon,.el-tooltip__popper').forEach(el => el.remove()); return clone.textContent.replace(/^[*＊\s]+|[*＊\s：:]+$/g,'').trim(); };
  const selectedText = node => {
    const selected=node.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item,.phoenix-select__calcEle,[class*="sd-Input-display-value-"]');
    if(selected)return selected.textContent.trim();
    const input=node.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]),textarea,select');
    return String(input?.tagName==='SELECT'?input.selectedOptions[0]?.textContent||'':input?.value||'').trim();
  };
  const nativeRadioRoot=node=>{
    if(!node?.matches('fieldset,[role="radiogroup"]')||node.matches('.ant-radio-group,.phoenix-radio-group'))return false;
    const radios=[...node.querySelectorAll('input[type="radio"]')];
    return radios.length>0&&radios.every(r=>r.name&&r.name===radios[0].name&&r.form===radios[0].form)&&!node.querySelector('input:not([type="radio"]),textarea,select');
  };
  const fileSurface=el=>el.closest('.file-single-wrap,.el-upload,[data-upload]')||el.closest('.ant-form-item,.el-form-item,.layui-form-item,.form-item,.form-group,.field')||el.closest('.ant-upload')||el.parentElement;
  const selector = el => {
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const siblings = [...n.parentElement.children].filter(s => s.tagName === n.tagName);
      parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(n) + 1})`);
    }
    return `html > ${parts.join(' > ')}`;
  };
  return [...document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"],.phoenix-select,.phoenix-radio-group,.ant-select,.ant-radio-group,.layui-form-select,fieldset,[role="radiogroup"]')]
    .filter(el=>!el.matches('select.citySelect')||el.parentElement.querySelector('select.citySelect')===el)
    .filter(el=>!el.matches('fieldset,[role="radiogroup"]')||nativeRadioRoot(el))
    .filter(el=>!nativeRadioRoot(el.parentElement?.closest('fieldset,[role="radiogroup"]')))
    .filter(el => !el.parentElement?.closest('.phoenix-select,.phoenix-radio-group,.ant-select,.ant-radio-group,.layui-form-select'))
    .filter(el => !el.closest('.el-input-group__prepend,.apply-form-date-now__node'))
    .filter(el => (visible(el)||(el.type==='file'&&visible(fileSurface(el)))) && !el.matches('input[type="hidden"], input[type="submit"], input[type="button"], input[type="reset"]'))
    .filter(el=>el.type!=='file'||fileSurface(el)?.querySelector('input[type="file"]')===el)
    .filter(el=>!(el.matches('input.layui-disabled')&&el.closest('.layui-form-item')?.querySelector('input[type="file"]')))
    .filter(el => !/搜索职位/.test((el.getAttribute('title')||'')+(el.getAttribute('placeholder')||'')))
    .filter(el => !el.closest('.constant-main-selector-container,.area-selector-container,.phoenix-calendar-month-calendar'))
    .filter(el => !(el.closest('[class*="sd-Select-container-"]') && el.closest('[class*="apply-field-"]')?.querySelectorAll('input').length>1 && /^(手机号码|证件号码)$/.test(el.closest('[class*="apply-field-"]').querySelector(':scope > [class*="title-"]')?.textContent.trim()||'')))
    .filter(el => !el.matches('[role="combobox"]') || !el.querySelector('input,select'))
    .map(el => {
      const labels = [...(el.labels || [])].map(labelText);
      const uploadSurface=el.type==='file'?fileSurface(el):null;
      const nativeRadioGroup=nativeRadioRoot(el);
      if(nativeRadioGroup){const legend=el.querySelector(':scope > legend');if(legend)labels.push(labelText(legend));}
      const structuredField=el.closest('[class*="apply-field-"]');
      if(structuredField){const title=structuredField.querySelector(':scope > [class*="title-"]');if(title){labels.length=0;labels.push(title.textContent.trim());}}
      let datePart;
      if(structuredField&&labels[0]==='就读时间'){
        const parts=[...structuredField.querySelectorAll('input')];
        if(parts.length===4&&parts.every((n,i)=>n.closest('[class*="sd-Select-container-"]')&&(!n.placeholder||n.placeholder===(i%2?'月':'年')))){
          const i=parts.indexOf(el);labels[0]=i<2?'入学时间':'毕业时间';datePart=i%2?'month':'year';
        }
      }
      const adjacentTitle=el.closest('.form-info')?.previousElementSibling;
      if(adjacentTitle?.matches('.form-title')){labels.length=0;labels.push(adjacentTitle.textContent.replace(/^[*\s]+|[：:\s]+$/g,''));}
      if (el.getAttribute('aria-labelledby')) labels.push(el.getAttribute('aria-labelledby').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
      const item = el.closest('.el-form-item,.ant-form-item,.form-item,.form-group,.field,.van-field,.layui-form-item,td');
      const itemLabel = item?.querySelector('label,.el-form-item__label,.ant-form-item-label,.label,.form-item__title');
      if (itemLabel && !adjacentTitle?.matches('.form-title')) labels.push(labelText(itemLabel));
      if(uploadSurface&&!labels.length){const title=uploadSurface.querySelector('button[title]')?.getAttribute('title');if(title)labels.push(title);else if(uploadSurface.querySelector('.resumeFileName'))labels.push('简历解析附件');}
      if(el.matches('.layui-form-select')&&itemLabel){
        const prior=item?.previousElementSibling;
        if(!labelText(itemLabel)&&prior?.querySelector('label')?.textContent.replace(/[*\s]/g,'')==='技能'){labels.length=0;labels.push('技能名称');}
        else if(labelText(itemLabel)==='技能'&&item?.nextElementSibling?.querySelector('select')){labels.length=0;labels.push('技能类别');}
      }
      labels.push(el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'));
      const headings = [];
      const formCell=el.closest('.form-cell');
      const cellTitle=formCell?.querySelector(':scope > .tit-wrap > .tit > p');
      if(cellTitle)headings.push(labelText(cellTitle));
      const structuredBlock=el.closest('[data-nav-id]');
      if(structuredBlock){const title=structuredBlock.querySelector('[class*="blockTitle-"] [class*="text-"]');if(title)headings.push(title.textContent.trim());}
      const moduleTitle=el.closest('.apply-module')?.querySelector('.form-content--title');
      if(moduleTitle) headings.push(moduleTitle.textContent.trim());
      const cellRecord=el.closest('.form-cell-inner');
      let block = cellRecord?selector(cellRecord):'';
      const phoenixForm = el.closest('.ux-standard-form');
      const recordIdentity = {};
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
      if(structuredRecord&&headings.includes('教育背景'))for(const f of structuredRecord.querySelectorAll('[class*="apply-field-"]')){
        const name=f.querySelector(':scope > [class*="title-"]')?.textContent.trim();
        const value=f.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()||f.querySelector('input')?.value||'';
        if(name==='学校名称')recordIdentity.school=value;
        if(name==='学历')recordIdentity.level=value==='硕士'?'硕士研究生':value==='博士'?'博士研究生':value;
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
        if (/^(获奖项|奖项)$/.test(label)) recordIdentity.award = field.querySelector('input')?.value || '';
        if (label === '实践名称' || label === '项目名称') recordIdentity.project = field.querySelector('input')?.value || '';
      }
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        if (phoenixForm) {
          const title = [...node.children].find(child => !child.contains(el) && /^(个人信息|求职意向|教育经历|工作经历|实习经历|实习\/工作经历|在校实践|在校职务|项目经历|论文\/专著|获奖情况|语言能力|外语能力|家庭情况|家庭信息|家庭关系|家庭其他成员|技能|附加信息|附加问题)$/.test(child.textContent.trim()));
          if (title && !headings.length) { headings.push(title.textContent.trim()); block = selector(phoenixForm); }
        }
        const heading = node.querySelector(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > .section-title, :scope > header > h2, :scope > header > h3');
        if (heading && visible(heading)) { headings.push(heading.textContent.trim().slice(0, 100)); if (!block) block = selector(node); }
      }
      if (!headings.length) {
        const before = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,.section-title')].filter(h => visible(h) && (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
        if (before.length) headings.push(before.at(-1).textContent.trim().slice(0, 100));
      }
      const type = el.getAttribute('type') || el.tagName.toLowerCase();
      const privateType = /password|file|checkbox|radio/.test(type);
      const componentGroup=el.closest('.cascader-plugins-wrap');
      const components=componentGroup?[...componentGroup.querySelectorAll('.ant-select')].filter(visible):[];
      const checked=nativeRadioGroup||el.matches('.ant-radio-group,.phoenix-radio-group')?el.querySelector('input:checked,.ant-radio-checked,.phoenix-radio--checked'):null;
      const observedValue=el.matches('select.citySelect')?[...el.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/,'')).join('/'):el.matches('.layui-form-select')?(el.previousElementSibling?.value?el.previousElementSibling.selectedOptions?.[0]?.textContent.trim()||'':''):el.matches('.ant-select')?selectedText(el):nativeRadioGroup?[...(checked?.labels||[])].map(labelText).join(' ').trim()||checked?.getAttribute('aria-label')||'':el.matches('.ant-radio-group,.phoenix-radio-group')?checked?.closest('label')?.textContent.trim()||checked?.textContent.trim()||'':el.matches('.phoenix-select')?el.querySelector('input')?.value.trim()||el.querySelector('.phoenix-select__tag')?.textContent.trim()||'':el.closest('[class*="sd-Select-container-"]')?selectedText(el.closest('[class*="sd-Select-container-"]')):el.tagName==='SELECT'?el.selectedOptions[0]?.textContent.trim()||'':String(el.value??el.textContent??'').trim();
      return { selector: selector(el), labels: [...new Set(labels.filter(Boolean))], headings, block, sectionBlock:formCell?selector(formCell):undefined,recordIdentity,datePart,
        observedValue,nativeRegion:el.matches('select.citySelect'),nativeRadioGroup,ongoingSelected:!!phoenixForm?.querySelector('input[type=checkbox]:checked'),ongoingCheckbox:el.type==='checkbox'&&el.closest('.phoenix-checkbox')?.textContent.trim()==='至今',
        fileNames:uploadSurface?[...new Set([...uploadSurface.querySelectorAll('.ant-upload-list-item-name,.el-upload-list__item-name,.resumeFileName,.file-name,[data-file-name],input.layui-disabled')].filter(visible).map(n=>String(n.value??n.textContent).trim()).filter(Boolean))]:undefined,
        componentIndex:components.length>1?components.indexOf(el):undefined,componentCount:components.length>1?components.length:undefined,
        existingText:labels.includes('专业名称')||labels.includes('专业')?String(el.matches('.ant-select')?selectedText(el):el.value||''):undefined,
        endedCheckbox:el.type==='checkbox'&&!el.checked&&el.closest('.phoenix-checkbox')?.textContent.trim()==='至今'&&!![...(phoenixForm?.querySelectorAll('.form-item')||[])].find(f=>f.querySelector('.form-item__title')?.textContent.trim()==='结束时间'&&/^\d{4}-\d{2}/.test(f.querySelector('input')?.value||'')),
        confirmedIdType:recordIdentity.idType==='身份证'||structuredField?.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()==='身份证'||el.closest('.form-item')?.querySelector('.mobile-type-button .phoenix-button__content')?.textContent.trim()==='身份证',
        elementSelect: !!el.closest('.el-select'), elementDate: !!el.closest('.el-date-editor,.apply-form-date-now'),
        customSelect: !!el.closest('.phoenix-select'), customRadio: el.matches('.phoenix-radio-group'),antSelect:el.matches('.ant-select'),antRadio:el.matches('.ant-radio-group'), invalidDate: el.matches('.phoenix-select') && el.textContent.includes('Invalid date'),
        dateValue: el.closest('.el-date-editor') ? el.value : undefined,
        tag: el.tagName.toLowerCase(), type, role: el.getAttribute('role'), required: el.required || /required/.test(el.getAttribute('lay-verify')||el.previousElementSibling?.getAttribute('lay-verify')||'') || !!itemLabel?.querySelector('em') || el.getAttribute('aria-required') === 'true'||!!item?.querySelector('.ant-form-item-required,.el-form-item__label.is-required,.labelRequired,.form-item__required'),
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true'||el.matches('.ant-select-disabled'), readonly: !!el.readOnly,
        hasValue:el.matches('select.citySelect')?!!observedValue:el.matches('.layui-form-select')?!!el.previousElementSibling?.value:nativeRadioGroup?!!checked:el.matches('.ant-select')?!!el.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent.trim():el.matches('.ant-radio-group')?!!el.querySelector('input:checked,.ant-radio-checked'):el.closest('[class*="sd-Select-container-"]') ? !!el.closest('[class*="sd-Select-container-"]').querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim() : el.matches('.phoenix-radio-group') ? !!el.querySelector('.phoenix-radio--checked') : el.matches('.phoenix-select') ? !!(el.querySelector('.phoenix-select__tag') || el.querySelector('input')?.value.trim()) : privateType ? false : !!String(el.value ?? el.textContent ?? '').trim() && !/^(请选择|please select|select an option)(?:[.…。\s]*)$/i.test(String(el.value ?? el.textContent ?? '').trim()),
        awardValue: recordIdentity.award ? String(el.querySelector?.('input')?.value ?? el.value ?? '').trim() : undefined,
        maxLength: el.maxLength > 0 ? el.maxLength : null,
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
  if(control.tag==='input'&&control.type==='text'&&!control.customSelect)value=value.replace(/\r?\n+/g,' ');
  if (spec.date) {
    if (value === '至今') return { reason: '“至今”需要选择网站的在读 / 在职选项' };
    const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return { reason: '日期格式需要人工核对' };
    if (control.type === 'month' || control.labels.some(t => /yyyy[-/]mm(?![-/]dd)|年月/.test(t.toLowerCase()))) value = value.slice(0, 7);
    else if (control.type === 'date' && !match[3]) return { reason: '只有年月，不能为日历控件补造日期' };
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
  if(control.nativeRegion){
    const normalizeRegion=s=>String(s).replace(/市辖区/g,'').replace(/(北京市|天津市|上海市|重庆市)[/,]\1/g,'$1').replace(/[省市\s/,，]/g,'');
    return !!expected&&normalizeRegion(actual)===normalizeRegion(expected);
  }

  if(spec.rank&&/^前\d+(?:\.\d+)?%$/.test(String(expected))&&/^前\d+(?:\.\d+)?%$/.test(String(actual))){const wanted=Number(String(expected).match(/[\d.]+/)[0]),seen=Number(String(actual).match(/[\d.]+/)[0]);if(seen>=wanted&&seen<=100)return true;}
  if(spec.rank&&/^前\d+(?:\.\d+)?%$/.test(String(expected))){const m=String(actual).match(/^(\d+)%[-～~](\d+)%$/),r=Number(String(expected).match(/[\d.]+/)[0]);if(m&&r>+m[1]&&r<=+m[2])return true;}
  if(expected===undefined||expected===null||String(expected)==='')return false;
  const wanted=String(expected),seen=String(actual??'');
  if(normalize(seen)===normalize(wanted))return true;
  const aliases=spec.optionAliases||{};
  const equivalent=Array.isArray(aliases)?aliases:Object.entries(aliases).filter(([key])=>normalize(key)===normalize(wanted)).flatMap(([,values])=>Array.isArray(values)?values:[values]);
  if(equivalent.some(value=>normalize(value)===normalize(seen)))return true;
  if(spec.date){
    const date=s=>String(s).replaceAll('/','-').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    const a=date(seen),b=date(wanted);
    if(a&&b&&a[1]===b[1]&&a[2]===b[2])return a[3]===b[3]||(!a[3]&&(control.type==='month'||(control.customSelect&&/^\d{4}-\d{2}$/.test(seen))||control.labels.some(t=>/yyyy[-/]mm(?![-/]dd)|年月/i.test(t))));
  }
  return false;
}

function confirmedRecordValue(record,key,origin){
  const overrides=Array.isArray(record.portalOverrides)?record.portalOverrides:[];
  const matches=overrides.filter(entry=>{
    if(!entry||typeof entry!=='object'||typeof entry.origin!=='string'||typeof entry.key!=='string'||entry.key!==key)return false;
    try{return new URL(entry.origin).origin===entry.origin&&entry.origin===origin;}catch{return false;}
  });
  if(matches.length>1)return {reason:'本站确认的字段口径存在多条记录，请核对后填写'};
  if(matches.length===1){
    if(typeof matches[0].value!=='string'||!matches[0].value.trim())return {reason:'本站确认的字段口径格式无效，请核对后填写'};
    return {value:matches[0].value,portalOverride:true};
  }
  return {value:record[key],portalOverride:false};
}

async function scanPage(page, profile, selections = {}) {
  const controls = [], frameFailures = [];
  for (const [frameIndex, frame] of page.frames().entries()) {
    try {
      if (frame !== page.mainFrame() && !(await (await frame.frameElement()).isVisible())) continue;
      const items = await frame.evaluate(inspectDocument);
      controls.push(...items.map(c => ({ ...c, frame, frameIndex, frameUrl: frame.url() })));
    } catch { frameFailures.push({ label: `页面框架 ${frameIndex + 1}`, status: 'pending', reason: '页面框架无法读取，待页面加载后重试' }); }
  }
  const items = controls.map((control, index) => {
    if(control.type==='file')return {...control,id:`field-${index}`,label:control.labels[0]||'附件上传',status:'pending',reason:control.fileNames?.length?'页面显示附件文件名，须单独核验真实文件及上传结果；未自动上传':'附件上传入口尚未核验，须检查所需真实文件；未自动上传'};
    if(control.headings.includes('论文/专著') && profile.noPublications) return {...control,id:`field-${index}`,label:control.labels[0]||'论文/专著',status:'notApplicable',reason:'本人确认无论文专著，本栏不适用，不填写'};
    let section = inferSection(control.headings.slice(0,1));
    if(control.headings.includes('在校实践')) section='projects';
    if (control.headings.some(h => /^(在校实践|论文\/专著)$/.test(h)) && section!=='projects') return { ...control, id: `field-${index}`, label: control.labels[0] || '未标注字段', status: control.hasValue ? 'existing' : 'pending', reason: '此栏目尚未建立确定的资料映射，保留已有内容' };
    if(!section&&control.headings.length)return {...control,id:`field-${index}`,label:control.labels[0]||'未标注字段',status:'pending',reason:'当前栏目尚未建立确定的资料映射，禁止跨栏目套用字段'};
    const learned = learnedMatch(profile.learnedFields || [], page.url(), control);
    let match = learned && (!section || learned.groupId === section) ? learned : matchField(control.labels, section);
    if(!match&&section==='additional'&&control.labels[0]==='自我评价')match=matchField(control.labels,'evaluation');
    if(!match&&section==='basic')match=matchField(control.labels,'intent');
    const item = { ...control, id: `field-${index}`, label: control.labels[0] || '未标注字段', section, match, status: 'pending' };
    if(match?.groupId==='projects' && control.recordIdentity?.project){
      const found=(profile.values.projects||[]).map((r,i)=>({r,i})).filter(({r})=>normalize(r.name)===normalize(control.recordIdentity.project));
      if(found.length!==1)return {...item,reason:'实践名称不能唯一对应项目，请先核对'};
      item.recordIndex=found[0].i;
    }
    if (match?.groupId === 'awards' && control.recordIdentity?.award) {
      const found = (profile.values.awards||[]).map((r,i)=>({r,i})).filter(({r})=>[r.name,...(r.aliases||[])].some(n=>normalize(n)===normalize(control.recordIdentity.award)));
      if(found.length!==1) return {...item,reason:'奖项名称无法唯一匹配，可能混入多项奖励；需拆分核对，不能按顺序填写'};
      item.recordIndex=found[0].i;
    }
    if(control.ongoingCheckbox&&control.ongoingSelected&&section==='campus'&&(profile.values.campus||[]).some(r=>r.name===control.recordIdentity.campus&&r.endTime==='至今'))return {...item,label:'至今',ongoingConfirmed:true,status:'existing',reason:'已核验对应学生经历持续至今'};
    if(control.endedCheckbox)return {...item,label:'至今',status:'notApplicable',reason:'本条已有结束时间，至今保持未勾选'};
    if (/password|file|checkbox|radio/.test(control.type)) return { ...item, reason: '登录、附件和确认选项由本人操作' };
    if (!match) return { ...item, reason: '名称不明确或属于多个栏目，需要补充映射' };
    const invalidDate = match.spec.date && control.invalidDate;
    const records = profile.values[match.groupId] || [];
    let recordIndex = item.recordIndex ?? selections[match.groupId] ?? 0;
    if (match.groupId === 'awards' && control.recordIdentity?.award) {
      const found = records.map((r,i)=>({r,i})).filter(({r})=>[r.name,...(r.aliases||[])].some(n=>normalize(n)===normalize(control.recordIdentity.award)));
      if (found.length !== 1) return {...item,reason:'已有奖项名称不能唯一匹配知识库，需核对后补填'};
      recordIndex = found[0].i;
    }
    if (match.groupId === 'education') {
      if (control.recordIdentity?.school || control.recordIdentity?.level) {
        const identity = control.recordIdentity;
        const matches = records.map((r,i) => ({r,i})).filter(({r}) => (!identity.school || normalize(r.school) === normalize(identity.school)) && (!identity.level || normalize(r.level) === normalize(identity.level)));
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
    if(match.groupId==='campus'&&control.recordIdentity?.campus){const found=records.map((r,i)=>({r,i})).filter(({r})=>r.name===control.recordIdentity.campus);if(found.length!==1)return {...item,reason:'学生经历身份不唯一'};recordIndex=found[0].i;}
    if(match.groupId==='skills'&&control.recordIdentity?.skillName){
      const found=records.map((r,i)=>({r,i})).filter(({r})=>normalize(r.name)===normalize(control.recordIdentity.skillName));
      if(found.length!==1)return {...item,reason:'技能名称不能唯一匹配知识库，请核对'};
      recordIndex=found[0].i;
    }
    if(match.groupId==='internship'&&control.recordIdentity?.company){
      const found=records.map((r,i)=>({r,i})).filter(({r})=>normalize(r.company)===normalize(control.recordIdentity.company));
      if(found.length!==1)return {...item,reason:'实习公司不能唯一匹配知识库，请核对'};
      recordIndex=found[0].i;
    }
    const record = records[recordIndex];
    if(record?.[match.key]==='至今'&&control.ongoingSelected&&match.key==='endTime')return {...item,recordIndex,ongoingConfirmed:true,status:'existing',reason:'已核验至今选项，结束日期留空'};
    item.recordIndex=recordIndex;
    if (!record) return { ...item, reason: '所选经历不存在，请刷新资料' };
    const confirmed=confirmedRecordValue(record,match.key,new URL(page.url()).origin);
    if(confirmed.reason)return {...item,reason:confirmed.reason};
    item.portalOverride=confirmed.portalOverride;
    let transformed = control.datePart&&/^\d{4}-\d{2}/.test(String(confirmed.value||''))?{value:control.datePart==='year'?String(confirmed.value).slice(0,4):String(Number(String(confirmed.value).slice(5,7)))}:valueForControl(confirmed.value, match.spec, control);
    if(match.groupId==='awards'&&match.key==='scope'&&new URL(page.url()).hostname==='stics.zhiye.com'&&transformed.value)transformed.value=({'省部级':'省区级','学校级':'院校级'})[transformed.value]||transformed.value;
    if(control.componentCount>1){
      const paths=[confirmed.value,record[`${match.key}Path`],record[`${match.key}FullPath`]].filter(path=>Array.isArray(path)&&path.length===control.componentCount);
      const uniquePaths=[...new Map(paths.map(path=>[JSON.stringify(path),path])).values()];
      const path=uniquePaths.length===1?uniquePaths[0]:null;
      if(!path||!path[control.componentIndex])return {...item,reason:uniquePaths.length>1?'同一字段存在相互冲突的级联路径，需核对':'同一字段包含多个级联控件，需要按已确认的省市路径分别匹配',status:'pending'};
      transformed=valueForControl(path[control.componentIndex],match.spec,control);
    }
    if(control.hasValue&&!invalidDate){
      const expected=transformed.value;
      if(valueMatches(control,expected,match.spec))return {...item,...transformed,status:'existing',reason:'已有内容与已确认知识库一致'};
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
    const key = `${item.match.groupId}:${item.recordIndex ?? selections[item.match.groupId] ?? 0}:${item.match.key}:${item.datePart||''}:${item.componentIndex??''}`;
    duplicates.set(key, [...(duplicates.get(key) || []), item]);
  }
  for (const list of duplicates.values()) if (list.length > 1) for (const item of list) {
    if (item.status === 'ready') { item.status = 'pending'; item.reason = '同栏目有多个相同字段，请只展开要填写的一条经历'; }
  }
  // Two identity fields in one undivided record container leave every dependent
  // field ambiguous, even if a date or description happens to appear only once.
  const identityKeys={education:'school',internship:'company',projects:'name',campus:'name',awards:'name',family:'name',skills:'name',languages:'name'};
  const identityScopes=new Map();
  const recordScope=item=>`${item.frameIndex}:${item.match?.groupId}:${item.block||item.sectionBlock||'unscoped'}`;
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

async function fillPage(page, profile, selections, cancelled = () => false, progress = () => {}) {
  await require('./job-context.cjs').readContext(page).catch(()=>{});
  if(require('./zhaopin.cjs').isZhaopin(page)&&String(profile.zhaopin?.save_authorized_company_id)===new URL(page.url()).searchParams.get('cid'))return require('./zhaopin.cjs').fillZhaopin(page,profile,cancelled);
  if(require('./qiyuan.cjs').isQiyuan(page))return require('./qiyuan.cjs').fillQiyuan(page,profile,cancelled);
  if(require('./aircas.cjs').isAircas(page))return require('./aircas.cjs').fillAircas(page,profile,cancelled);
  if(require('./wjx.cjs').isWjx(page))return require('./wjx.cjs').fillWjx(page,profile,cancelled);
  const started = Date.now();
  const educationFailures=[];
  try{await require('./phoenix-family.cjs').ensurePhoenixFamily(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增家庭成员',status:'pending',reason:e.message});}
  try{await require('./phoenix-campus.cjs').ensurePhoenixCampus(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增学生经历',status:'pending',reason:e.message});}
  try{await require('./structured-education.cjs').ensureEducation(page,profile,cancelled);}catch(e){educationFailures.push({label:'新增教育经历',status:'pending',reason:e.message});}
  let addition;
  try{addition=await ensureProjects(page,profile,cancelled);}catch(e){addition={added:[],pending:[e.message]};}
  let awards;
  try{awards=await ensureAwards(page,profile,cancelled);}catch(e){awards={pending:[e.message]};}
  let cellRecords;
  try{cellRecords=await require('./form-cell-records.cjs').ensureFormCellRecords(page,profile,cancelled);}catch(e){cellRecords={added:[],pending:[e.message]};}
  let scan = await scanPage(page, profile, selections);
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
    const key=controlKey(item);
    const previous=attempted.get(key);
    if(previous&&previous.value===item.value){item.status=previous.status;item.reason=previous.reason;item.controlType=previous.controlType;item.attempts=previous.attempts;continue;}
    const start = Date.now();
    try {
      if (cancelled() || page.url() !== scan.url) { item.status = 'pending'; item.reason = '已停止或页面已切换'; continue; }
      if (item.frame.url() !== item.frameUrl) throw new Error('FRAME_CHANGED');
      const locator = item.frame.locator(item.selector);
      if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('CHANGED');
      const current = await locator.evaluate(el => ({ value: String(el.value ?? el.textContent ?? '').trim(), tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || el.tagName.toLowerCase(), readonly: !!el.readOnly, name: el.getAttribute('name') }));
      current.value = await locator.evaluate(controlValue);
      if (current.tag !== item.tag || current.type !== item.type || (current.name && !item.labels.includes(current.name))) throw new Error('CHANGED');
      if (current.value && !(item.datePart && !item.hasValue) && !/^(请选择|please select|select an option)(?:[.…。\s]*)$/i.test(current.value) && !(item.match.spec.date && current.value==='Invalid date')) {
        item.status=valueMatches(item,item.value,item.match.spec,current.value)?'existing':'pending';item.reason=item.status==='existing'?'页面新带入内容与知识库一致':'页面新带入内容与知识库不一致，保留待核对';continue;
      }
      const result=await executeControl(item.frame,locator,{...item,cancelled,allowOverwrite:!!item.datePart&&!item.hasValue});
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
    try {
      if (page.url() !== scan.url || item.frame.url() !== item.frameUrl) throw new Error('changed');
      const actual = await item.frame.locator(item.selector).evaluate(controlValue);
      if (actual !== item.expected) throw new Error('changed');
    } catch { item.status = 'pending'; item.reason = '后续页面变化影响了此字段，请重新核对'; }
  }
  // Existing is a claim about the current DOM value, never about saved server state.
  // Re-read at the end because later dependency callbacks can change untouched fields too.
  for(const item of scan.items.filter(i=>i.status==='existing')){
    try{
      if(page.url()!==scan.url||item.frame.url()!==item.frameUrl)throw new Error('changed');
      const locator=item.frame.locator(item.selector);
      if(item.ongoingConfirmed){if(!await locator.evaluate(el=>!!el.closest('.ux-standard-form')?.querySelector('input[type=checkbox]:checked')))throw Error('changed');continue;}
      const actual=item.tag==='select'&&!item.nativeRegion?await locator.evaluate(el=>el.selectedOptions[0]?.textContent.trim()||''):await locator.evaluate(controlValue);
      if(!valueMatches(item,item.value,item.match?.spec,actual)||!await locator.evaluate(el=>!el.validity||el.validity.valid))throw new Error('changed');
    }catch{item.status='pending';item.reason='已有内容在最终回读时未能确认与知识库一致，请核对';}
  }
  return report(scan, Date.now() - started);
}
module.exports = { inspectDocument, inferSection, scanPage, fillPage, report, valueForControl, selectOption, valueMatches,confirmedRecordValue };
