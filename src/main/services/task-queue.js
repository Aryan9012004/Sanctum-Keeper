class TaskQueue {
  constructor(concurrency = 4, onUpdate = () => {}) { this.concurrency = Math.max(1, Math.min(4, concurrency)); this.onUpdate = onUpdate; this.pending = []; this.running = 0; this.seen = new Set(); this.counts = { pending: 0, running: 0, completed: 0, skipped: 0, failed: 0 }; }
  add(key, task) { if (this.seen.has(key)) return false; this.seen.add(key); this.pending.push({ key, task }); this.counts.pending++; this.pump(); return true; }
  pump() { while (this.running < this.concurrency && this.pending.length) { const item = this.pending.shift(); this.running++; this.counts.pending--; this.counts.running++; this.onUpdate({ ...this.counts }); Promise.resolve().then(item.task).then(status => { this.counts[status === 'skipped' ? 'skipped' : 'completed']++; }).catch(() => { this.counts.failed++; }).finally(() => { this.running--; this.counts.running--; this.seen.delete(item.key); this.onUpdate({ ...this.counts }); this.pump(); }); } }
}
module.exports = { TaskQueue };
