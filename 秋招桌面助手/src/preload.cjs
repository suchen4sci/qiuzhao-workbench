const { contextBridge, ipcRenderer } = require('electron');
const channels = new Set(['profile','refresh-profile','copy-field','copy-record','navigate','demo','browser-action','browser-visible','browser-rect','stop','run','handoff','teaching','dashboard-open','dashboard-draft','dashboard-import','runtime-info','sync-hot-report']);
contextBridge.exposeInMainWorld('desktop', {
  call: (name, data) => { if (!channels.has(name)) throw new Error('Unknown action'); return ipcRenderer.invoke(name, data); },
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); },
});
