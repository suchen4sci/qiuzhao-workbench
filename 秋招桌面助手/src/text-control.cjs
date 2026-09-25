// Reusable for ordinary editable text fields; custom pickers keep their own executors.
async function fillTextControl(locator, value) {
  const expected = String(value);
  const state = await locator.evaluate(e => ({tag:e.tagName,type:e.type,editable:e.isContentEditable,readonly:e.readOnly,disabled:e.disabled,max:e.maxLength,role:e.getAttribute('role')}));
  if ((!state.editable&&!['INPUT','TEXTAREA'].includes(state.tag)) || state.readonly || state.disabled || state.role === 'combobox' || (!state.editable&&!['text','email','tel','url','search','textarea','number'].includes(state.type))) throw Error('需要专用控件策略');
  if (state.max >= 0 && expected.length > state.max) throw Error('正文超过限制，未截断');
  const attempts = [];
  for (const method of ['fill-and-blur','keyboard-and-blur']) {
    try {
      if (method === 'fill-and-blur') await locator.fill(expected,{timeout:1500});
      else {
        await locator.click({timeout:1500});
        await locator.press('ControlOrMeta+A');
        await locator.press('Backspace');
        await locator.pressSequentially(expected,{timeout:5000});
      }
      await locator.press('Tab',{timeout:700});
      await locator.page().waitForTimeout(120);
      const result = await locator.evaluate(e=>({value:e.value??e.textContent,valid:!e.validity||e.validity.valid}));
      if (result.value === expected && result.valid) {
        attempts.push({method,status:'verified'});
        return {value:expected,attempts};
      }
      attempts.push({method,status:'unverified',reason:result.valid?'回读不一致':'字段校验未通过'});
      if(!result.valid)break;
    } catch(e) { attempts.push({method,status:'failed',reason:e.message}); }
  }
  const error = Error('文本控件两种策略均未通过回读校验');
  error.attempts = attempts;
  throw error;
}
function confirmedAge(member, today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})) {
  return member.age_confirmed_on === today ? member.age : undefined;
}
module.exports = {fillTextControl,confirmedAge};
