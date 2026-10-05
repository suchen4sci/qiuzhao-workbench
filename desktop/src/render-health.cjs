// Playwright waits for animation frames before a normal click. A minimized Electron
// window can suspend these frames even when focus emulation reports it as visible.
async function measureRendering(page, timeoutMs = 1200) {
  let timer;
  try {
    return await Promise.race([
      page.evaluate(() => new Promise(resolve => {
        const start = performance.now(); let frames = 0;
        function tick() {
          if (++frames === 3) resolve({ healthy: true, frames, elapsedMs: Math.round(performance.now() - start), visibility: document.visibilityState, focused: document.hasFocus() });
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ healthy: false, frames: 0, reason: 'animation-frames-paused' }), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
async function ensureRendering(page, restoreWindow) {
  const before = await measureRendering(page);
  if (before.healthy) return { ...before, recovered: false };
  // No synthetic page events, force-clicks, or artificial animation timers.
  if (restoreWindow) await restoreWindow();
  await page.bringToFront();
  const after = await measureRendering(page, 2000);
  if (!after.healthy) {
    const error = new Error('招聘窗口的渲染帧仍暂停，已停止填写。请恢复该窗口后重试，避免每个字段都因等待稳定帧而超时。');
    error.code = 'RENDER_PAUSED'; error.renderHealth = after; throw error;
  }
  return { ...after, recovered: true };
}
module.exports = { measureRendering, ensureRendering };
