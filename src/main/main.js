const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');
const { classifyFile, isTemporary } = require('./services/rules');
const { moveSafely, hashFile, isWithin } = require('./services/file-mover');
const { Journal } = require('./services/journal');
const { TaskQueue } = require('./services/task-queue');
const { FolderWatcher } = require('./services/watcher');

let win, journal, config, watcher, activeFolder = null;
const configPath = () => path.join(app.getPath('userData'), 'config.json');
const journalPath = () => path.join(app.getPath('userData'), 'journal.json');
const defaultConfig = { categoryFolders: {}, customRules: [], autoMode: false };
function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 980, minHeight: 650, backgroundColor: '#0b1020', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
async function readConfig() {
  try { const loaded = JSON.parse(await fs.readFile(configPath(), 'utf8')); config = { ...defaultConfig, ...loaded, customRules: Array.isArray(loaded.customRules) ? loaded.customRules : [] }; }
  catch { config = { ...defaultConfig }; }
}
async function scan(folder) {
  if (typeof folder !== 'string' || !path.isAbsolute(folder)) throw new Error('Choose a valid absolute folder path');
  const resolved = path.resolve(folder);
  if (resolved === path.parse(resolved).root) throw new Error('Drive roots cannot be organized. Choose a dedicated folder instead.');
  const protectedPaths = [process.env.WINDIR, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter(Boolean).map(p => path.resolve(p).toLowerCase());
  if (protectedPaths.some(p => resolved.toLowerCase() === p || resolved.toLowerCase().startsWith(p + path.sep.toLowerCase()))) throw new Error('Windows system and program directories are protected. Choose a normal user folder.');
  const st = await fs.lstat(folder); if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Selected path must be a real folder');
  const files = await fs.readdir(folder, { withFileTypes: true }); const rows = [];
  for (const item of files) {
    if (!item.isFile() || item.isSymbolicLink()) continue;
    const source = path.join(folder, item.name); const info = await fs.stat(source).catch(() => null); if (!info) continue;
    const result = classifyFile(item.name, config.customRules, config.categoryFolders);
    const category = result.category;
    const destinationDir = path.join(folder, category, result.subfolder || '');
    rows.push({ name: item.name, source, size: info.size, extension: path.extname(item.name) || '(none)', category, destination: path.join(destinationDir, item.name), reason: result.reason || '', skipped: category === 'Skipped' });
  }
  return rows;
}
async function organize(payload) {
  const folder = payload?.folder; const selected = Array.isArray(payload?.files) ? payload.files : [];
  if (!folder || !path.isAbsolute(folder) || !selected.length) throw new Error('Folder and file preview are required');
  const current = await scan(folder); const allowed = new Map(current.map(f => [f.source, f]));
  const batchId = crypto.randomUUID(); const summary = { batchId, completed: 0, skipped: 0, failed: 0, total: selected.length, errors: [] };
  const queue = new TaskQueue(4, counts => win?.webContents.send('operation:progress', { ...counts, ...summary }));
  const promises = selected.map(row => new Promise(resolve => {
    const accepted = queue.add(row.source, async () => {
      const planned = allowed.get(row.source);
      if (!planned || planned.skipped || !isWithin(folder, planned.source) || !isWithin(folder, planned.destination)) { summary.skipped++; resolve(); return 'skipped'; }
      const entry = await journal.add({ batchId, originalPath: planned.source, destinationPath: planned.destination, originalName: planned.name, category: planned.category, status: 'in-progress', undoable: false });
      try {
        const before = await fs.stat(planned.source); if (!before.isFile()) throw new Error('Not a regular file');
        const moved = await moveSafely(planned.source, planned.destination);
        await journal.update(entry.id, { status: 'completed', destinationPath: moved.destination, size: moved.size, sha256: moved.sha256, undoable: true });
        summary.completed++; resolve(); return 'completed';
      } catch (error) { await journal.update(entry.id, { status: 'failed', error: error.message, undoable: false }); summary.failed++; summary.errors.push(`${planned.name}: ${error.message}`); resolve(); throw error; }
    });
    if (!accepted) { summary.skipped++; resolve(); }
  }));
  await Promise.all(promises);
  return summary;
}
async function undo(id) {
  const entry = journal.entries.find(e => e.id === id);
  if (!entry || entry.status !== 'completed' || !entry.undoable) throw new Error('This operation is not eligible for Undo');
  const currentHash = await hashFile(entry.destinationPath);
  if (entry.sha256 && currentHash !== entry.sha256) throw new Error('File changed after being moved. Undo was blocked to protect your data.');
  const result = await moveSafely(entry.destinationPath, entry.originalPath);
  await journal.update(id, { status: 'undone', undoable: false, restoredPath: result.destination });
  return { success: true, restoredPath: result.destination };
}
async function findDuplicates(folder) {
  const rows = await scan(folder); const groups = new Map(); const errors = [];
  for (const row of rows) { if (row.skipped) continue; try { const hash = await hashFile(row.source); if (!groups.has(hash)) groups.set(hash, []); groups.get(hash).push({ name: row.name, path: row.source, size: row.size }); } catch (e) { errors.push(`${row.name}: ${e.message}`); } }
  return { groups: [...groups.entries()].filter(([, files]) => files.length > 1).map(([sha256, files]) => ({ sha256, files })), errors };
}
app.whenReady().then(async () => {
  await readConfig(); journal = new Journal(journalPath()); await journal.load(); watcher = new FolderWatcher(async file => {
    if (!activeFolder) return;
    try { const row = (await scan(activeFolder)).find(f => f.source === file); if (row && !row.skipped) await organize({ folder: activeFolder, files: [row] }); } catch (e) { console.error('Auto organize failed:', e.message); }
  });
  ipcMain.handle('folder:choose', async () => { const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return result.canceled ? null : result.filePaths[0]; });
  ipcMain.handle('folder:scan', async (_e, folder) => { activeFolder = folder; return scan(folder); });
  ipcMain.handle('files:organize', async (_e, payload) => organize(payload));
  ipcMain.handle('history:get', async () => journal.all());
  ipcMain.handle('history:undo', async (_e, id) => undo(id));
  ipcMain.handle('duplicates:find', async (_e, folder) => findDuplicates(folder));
  ipcMain.handle('watcher:start', async (_e, folder) => { activeFolder = folder; await scan(folder); await watcher.start(folder); config.autoMode = true; await fs.writeFile(configPath(), JSON.stringify(config, null, 2)); return { active: true }; });
  ipcMain.handle('watcher:stop', async () => { await watcher.stop(); config.autoMode = false; await fs.writeFile(configPath(), JSON.stringify(config, null, 2)); return { active: false }; });
  ipcMain.handle('config:get', async () => config);
  ipcMain.handle('rules:save', async (_e, rules) => { if (!Array.isArray(rules) || rules.some(r => !r || typeof r !== 'object' || typeof r.category !== 'string' || !/^[\w -]{1,40}$/.test(r.category) || (r.subfolder && (path.isAbsolute(r.subfolder) || r.subfolder.split(/[\\/]/).includes('..'))))) throw new Error('Invalid custom rules'); config.customRules = rules; await fs.writeFile(configPath(), JSON.stringify(config, null, 2)); return config.customRules; });
  createWindow();
});
app.on('before-quit', () => { watcher?.stop(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
