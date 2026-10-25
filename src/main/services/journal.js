const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class Journal {
  constructor(filePath) { this.filePath = filePath; this.entries = []; }
  async load() {
    try { const data = JSON.parse(await fs.readFile(this.filePath, 'utf8')); this.entries = Array.isArray(data) ? data : []; }
    catch (e) { if (e.code !== 'ENOENT') { const backup = `${this.filePath}.corrupt-${Date.now()}`; try { await fs.rename(this.filePath, backup); } catch {} } this.entries = []; }
    return this.entries;
  }
  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    const handle = await fs.open(tmp, 'w');
    try { await handle.writeFile(JSON.stringify(this.entries, null, 2), 'utf8'); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(tmp, this.filePath);
  }
  async add(entry) { const item = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), status: 'planned', undoable: false, ...entry }; this.entries.unshift(item); await this.save(); return item; }
  async update(id, patch) { const item = this.entries.find(e => e.id === id); if (!item) throw new Error('Journal entry not found'); Object.assign(item, patch, { updatedAt: new Date().toISOString() }); await this.save(); return item; }
  async all() { return this.entries; }
}
module.exports = { Journal };
