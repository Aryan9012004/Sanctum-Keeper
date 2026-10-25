const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isTemporary } = require('./rules');

async function hashFile(file) {
  const { createReadStream } = require('node:fs');
  return new Promise((resolve, reject) => { const hash = crypto.createHash('sha256'); const stream = createReadStream(file); stream.on('data', d => hash.update(d)); stream.on('error', reject); stream.on('end', () => resolve(hash.digest('hex'))); });
}
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function collisionSafePath(dest) {
  if (!(await exists(dest))) return dest;
  const dir = path.dirname(dest), ext = path.extname(dest), base = path.basename(dest, ext);
  for (let i = 1; i < 100000; i++) { const candidate = path.join(dir, `${base} (${i})${ext}`); if (!(await exists(candidate))) return candidate; }
  throw new Error('Could not find a free destination filename');
}
function isWithin(parent, child) { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); }

async function moveSafely(source, destination) {
  if (isTemporary(path.basename(source))) throw new Error('Temporary files are not moved');
  const sourceStat = await fs.lstat(source);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error('Only regular files can be moved');
  if (path.resolve(source) === path.resolve(destination)) throw new Error('Source and destination are the same');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const finalPath = await collisionSafePath(destination);
  let linked = false;
  try {
    // Hard-link creation is atomic and refuses to overwrite an existing destination.
    await fs.link(source, finalPath);
    linked = true;
  } catch (err) {
    if (!['EXDEV','EPERM','EACCES','ENOTSUP','EMLINK'].includes(err.code)) throw err;
    const temp = `${finalPath}.${crypto.randomUUID()}.copying`;
    try {
      await fs.copyFile(source, temp, require('node:fs').constants.COPYFILE_EXCL);
      const [srcHash, dstHash] = await Promise.all([hashFile(source), hashFile(temp)]);
      if (srcHash !== dstHash) throw new Error('Copy verification failed; original preserved');
      // Link the verified temporary file to reserve the final path atomically.
      await fs.link(temp, finalPath);
      await fs.unlink(temp);
      linked = true;
    } catch (copyErr) {
      try { await fs.unlink(temp); } catch {}
      throw copyErr;
    }
  }
  if (!linked) throw new Error('Destination could not be committed');
  // If removing the original fails, keep both copies rather than risk data loss.
  try { await fs.unlink(source); }
  catch (err) { throw new Error(`Destination created at ${finalPath}, but original could not be removed: ${err.message}`); }
  const stat = await fs.stat(finalPath);
  return { destination: finalPath, size: stat.size, sha256: await hashFile(finalPath) };
}
module.exports = { moveSafely, collisionSafePath, hashFile, isWithin };
