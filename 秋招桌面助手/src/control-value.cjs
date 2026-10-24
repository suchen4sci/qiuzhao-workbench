function controlValue(el) {
  if(el.matches('.slt,.dateSlt')){const t=el.querySelector(':scope >span')?.textContent.trim()||'';return /^(请选择|请输入)/.test(t)?'':t;}
  if(el.matches('input.inputxt')&&(/^(请输入|请选择|输入毕业院校名称)/.test(el.value)||el.classList.contains('inputCity')&&el.closest('dl')?.querySelector('dt')?.textContent.replace(/[*＊]/g,'').trim()===el.value))return '';

  if(el.matches('select.citySelect'))return [...el.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/,'')).join('/');

  if(el.matches('.layui-form-select'))return el.previousElementSibling?.value?el.previousElementSibling.selectedOptions?.[0]?.textContent.trim()||'':'';
  if(el.matches('[role="radiogroup"],fieldset,.radio_list,dt,dd')){
    const radios=[...el.querySelectorAll('input[type="radio"]')];
    if(radios.length&&radios[0].name&&radios.every(r=>r.name===radios[0].name&&r.form===radios[0].form)&&!el.querySelector('input:not([type="radio"]),select,textarea')){
      const checked=radios.find(input=>input.checked);
      if(checked?.dataset.code==='Y'&&checked.nextSibling?.textContent.trim().startsWith('是'))return '是';if(checked?.dataset.code==='N'&&checked.nextSibling?.textContent.trim().startsWith('否'))return '否';
      return (checked?.labels?.[0]?.textContent||checked?.getAttribute('aria-label')||checked?.nextSibling?.textContent?.trim()||checked?.nextElementSibling?.textContent||'').replace(/\s+/g,' ').trim();
    }
  }
  const antRadio=el.closest('.ant-radio-group');
  if(antRadio){
    const checked=[...antRadio.querySelectorAll('input[type="radio"]')].find(input=>input.checked);
    return checked?.closest('label')?.textContent.trim()||'';
  }
  const antSelect=el.closest('.ant-select');
  if(antSelect){
    const selected=antSelect.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item');
    return selected?.textContent.trim()||'';
  }
  const sd=el.closest('[class*="sd-Select-container-"]');
  if(sd?.classList.contains('multi_select_info'))return [...sd.querySelectorAll('[class*="sd-Tag-text-"]')].map(e=>e.textContent.trim()).join(',');
  if(sd){const display=sd.querySelector('[class*="sd-Input-display-value-"]')?.cloneNode(true);display?.querySelectorAll('[class*="sd-Select-ghost-"]').forEach(e=>e.remove());return display?.textContent.trim()||'';}
  if (el.matches('.phoenix-radio-group')) return el.querySelector('.phoenix-radio--checked')?.textContent.trim() || '';
  if (el.matches('.phoenix-select')) {
    const tags = [...el.querySelectorAll('.phoenix-select__tag')].map(e=>e.textContent.trim());
    if (tags.length) return tags.join('、');
    return el.querySelector('input')?.value.trim() || el.querySelector('.phoenix-select__tipWrapper--visible')?.textContent.trim() || '';
  }
  return String(el.value ?? el.textContent ?? '').trim();
}
module.exports = { controlValue };
