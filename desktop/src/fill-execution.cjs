'use strict';
// Each run owns its wrappers and signal. Keep the native takeover barrier up until
// runFill settles: evaluate() and some low-level input calls cannot be aborted.
const API_OBJECTS = new Set(['Page', 'Frame', 'FrameLocator', 'Locator', 'ElementHandle', 'JSHandle', 'Keyboard', 'Mouse', 'Touchscreen']);
const LOCATOR_OPTIONS = { click:0, dblclick:0, hover:0, tap:0, check:0, uncheck:0, clear:0, fill:1, press:1, pressSequentially:1, type:1, selectOption:1, setChecked:1, setInputFiles:1, dragTo:1, waitFor:0, waitForElementState:1 };
const PAGE_OPTIONS = { click:1, dblclick:1, hover:1, tap:1, check:1, uncheck:1, fill:2, press:2, type:2, selectOption:2, setChecked:2, setInputFiles:2, waitForSelector:1, waitForFunction:2 };
const SYNCHRONOUS = new Set(['url', 'isClosed', 'isDetached', 'name', 'locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTitle', 'getByAltText', 'getByTestId', 'filter', 'nth', 'first', 'last', 'and', 'or', 'frameLocator', 'contentFrame', 'owner', 'page', 'frame', 'frames', 'mainFrame', 'parentFrame', 'childFrames']);
function abortablePage(page, signal) {
  const wrapped = new WeakMap(), originals = new WeakMap();
  const check = () => signal.throwIfAborted();
  function unwrap(value) {
    if (!value || typeof value !== 'object') return value;
    if (originals.has(value)) return originals.get(value);
    if (Array.isArray(value)) return value.map(unwrap);
    if (Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, unwrap(v)]));
    return value;
  }
  function wrap(value) {
    if (Array.isArray(value)) return value.map(wrap);
    if (value instanceof Map) return new Map([...value].map(([k,v])=>[k,wrap(v)]));
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,wrap(v)]));
    const kind = value?.constructor?.name?.replace(/^_+/, '');
    if (!value || !API_OBJECTS.has(kind)) return value;
    if (wrapped.has(value)) return wrapped.get(value);
    const proxy = new Proxy(value, { get(target, key) {
      if(typeof key === 'string' && (key.startsWith('_') || ['context','browser','request','on','once','addListener','prependListener','newCDPSession'].includes(key))) throw new Error('填写执行期间禁止绕过本轮保护');
      const member = Reflect.get(target, key, target);
      if (typeof member !== 'function') return wrap(member);
      return (...given) => {
        // Synchronous locator builders are safe after cancellation; no input is sent.
        // All asynchronous APIs, including evaluate and recovery actions, fail closed.
        if (!SYNCHRONOUS.has(key)) check();
        const args = given.map(unwrap);
        const options = kind === 'Page' || kind === 'Frame' ? PAGE_OPTIONS : kind === 'Mouse' ? {click:2,dblclick:2,move:2,down:0,up:0,wheel:2} : kind === 'Keyboard' ? {press:1,type:1,down:1,up:1,insertText:1} : kind === 'Touchscreen' ? {tap:2} : LOCATOR_OPTIONS;
        const optionIndex = options[key];
        if (optionIndex !== undefined) args[optionIndex] = { ...args[optionIndex], signal };
        const result = member.apply(target, args);
        if (result && typeof result.then === 'function') return result.then(answer => { check(); return wrap(answer); });
        return wrap(result);
      };
    }});
    wrapped.set(value, proxy); originals.set(proxy, value); return proxy;
  }
  return wrap(page);
}
async function runFill(page, profile, selections, { signal, progress = () => {}, fillPage, inspectPage } = {}) {
  const engine = fillPage && inspectPage ? {fillPage, inspectPage} : require('./engine.cjs');
  const started = Date.now();
  try {
    signal.throwIfAborted();
    const result = await engine.fillPage(abortablePage(page, signal), profile, selections, () => signal.aborted, progress);
    signal.throwIfAborted();
    return { ...result, execution: { state:'complete' } };
  } catch (error) {
    if (!signal.aborted) throw error;
    // Read the current page after all input has settled. Do not label interrupted
    // writes as verified fills, nor reuse an old page's successful report.
    let result;
    try { result = await engine.inspectPage(page, profile, selections); }
    catch { result = {fields:[], counts:{filled:0,ready:0,pending:0,existing:0,failed:0,notApplicable:0}}; }
    return { ...result, elapsedMs:Date.now()-started, execution:{state:'paused',reason:String(signal.reason?.message || '已暂停'),rescanRequired:true} };
  }
}
module.exports = {abortablePage, runFill};
