function controlValue(el) {
  if(el.matches('select.citySelect'))return [...el.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/,'')).join('/');

  if(el.matches('.layui-form-select'))return el.previousElementSibling?.value?el.previousElementSibling.selectedOptions?.[0]?.textContent.trim()||'':'';
  if(el.matches('[role="radiogroup"],fieldset')){
    const radios=[...el.querySelectorAll('input[type="radio"]')];
    if(radios.length&&radios[0].name&&radios.every(r=>r.name===radios[0].name&&r.form===radios[0].form)&&!el.querySelector('input:not([type="radio"]),select,textarea')){
      const checked=radios.find(input=>input.checked);
      return (checked?.labels?.[0]?.textContent||checked?.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
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
  if(sd)return sd.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()||'';
  if (el.matches('.phoenix-radio-group')) return el.querySelector('.phoenix-radio--checked')?.textContent.trim() || '';
  if (el.matches('.phoenix-select')) {
    const tags = [...el.querySelectorAll('.phoenix-select__tag')].map(e=>e.textContent.trim());
    if (tags.length) return tags.join('、');
    return el.querySelector('input')?.value.trim() || el.querySelector('.phoenix-select__tipWrapper--visible')?.textContent.trim() || '';
  }
  return String(el.value ?? el.textContent ?? '').trim();
}
module.exports = { controlValue };
