async function fillRegion(frame, input, path) {
  if (!Array.isArray(path) || path.length < 1 || path.length > 4 || path.some(p=>typeof p !== 'string' || !p)) throw new Error('REGION_PATH');
  if ((await input.inputValue()).trim()) throw new Error('REGION_EXISTING');
  const panel = frame.locator('.area-selector-container:visible');
  if (await panel.count() === 0) await input.click({timeout:1200});
  await panel.waitFor({state:'visible',timeout:1500});
  if (await panel.count() !== 1) throw new Error('REGION_AMBIGUOUS');
  const chosen = panel.locator('.select-area-text-label');
  const matchesPath=t=>t.trim()===path.at(-1)||t.trim()===path.join('/');
  if (await chosen.count() && (await chosen.allTextContents()).some(t=>!matchesPath(t))) throw new Error('REGION_EXISTING');
  const root = panel.locator('.phoenix-breadcrumb-text').filter({hasText:/^全部省市$/});
  await root.click({timeout:1200});
  for (let i=0;i<path.length;i++) {
    const label = panel.locator('.area-text-label').filter({hasText:new RegExp(`^${path[i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)});
    await label.waitFor({state:'visible',timeout:1500});
    if (await label.count() !== 1) throw new Error('REGION_AMBIGUOUS');
    const row = label.locator('..');
    if (i < path.length-1) {
      const arrow = row.locator('.area-icon-right.visible');
      if (await arrow.count() !== 1) throw new Error('REGION_PATH');
      await arrow.click({timeout:1200});
    } else if (await row.locator('.area-icon-RadioChecked').count() === 0) {
      await row.locator('.icon-container').click({timeout:1200});
    }
  }
  if (await chosen.count() !== 1 || !matchesPath(await chosen.textContent())) throw new Error('VERIFY');
  const confirm = panel.locator('.phoenix-button__content').filter({hasText:/^确定$/});
  if (await confirm.count() !== 1) throw new Error('REGION_AMBIGUOUS');
  await confirm.click({timeout:1200});
  await panel.waitFor({state:'hidden',timeout:1500});
  const actual = await input.inputValue();
  if (!actual.includes(path.at(-1))) throw new Error('VERIFY');
  return actual;
}
module.exports = { fillRegion };
