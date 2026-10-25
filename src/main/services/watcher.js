const chokidar = require('chokidar');
const path = require('node:path');
const { isTemporary } = require('./rules');
class FolderWatcher {
  constructor(onFile) { this.onFile = onFile; this.watcher = null; }
  async start(folder) {
    if (this.watcher) await this.stop();
    this.watcher = chokidar.watch(folder, { persistent: true, ignoreInitial: true, depth: 0, awaitWriteFinish: { stabilityThreshold: 1800, pollInterval: 250 }, ignored: p => isTemporary(path.basename(p)) });
    this.watcher.on('add', file => { if (!isTemporary(path.basename(file))) this.onFile(file); });
    this.watcher.on('error', err => console.error('Folder watcher error:', err.message));
  }
  async stop() { if (this.watcher) { await this.watcher.close(); this.watcher = null; } }
}
module.exports = { FolderWatcher };
