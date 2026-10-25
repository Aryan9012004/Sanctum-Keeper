const path = require('node:path');

const DEFAULT_CATEGORIES = {
  Documents: ['.pdf','.doc','.docx','.txt','.rtf','.odt','.xls','.xlsx','.ppt','.pptx'],
  Images: ['.jpg','.jpeg','.png','.gif','.svg','.webp','.bmp','.tif','.tiff'],
  Videos: ['.mp4','.mkv','.mov','.avi','.webm','.wmv'],
  Audio: ['.mp3','.wav','.aac','.flac','.ogg','.m4a'],
  Archives: ['.zip','.rar','.7z','.tar','.gz'],
  Code: ['.js','.ts','.html','.css','.json','.py','.c','.cpp','.h','.java','.sql','.sh'],
  Installers: ['.exe','.msi','.msix','.apk']
};
const TEMP_EXTENSIONS = new Set(['.crdownload','.part','.tmp','.download']);

function classifyFile(filename, customRules = [], categoryNames = {}) {
  const lower = filename.toLowerCase();
  const ext = path.extname(lower);
  if (TEMP_EXTENSIONS.has(ext)) return { category: 'Skipped', reason: 'Temporary or in-progress file' };
  for (const rule of customRules.filter(r => r.enabled !== false)) {
    if (rule.pattern && typeof rule.pattern === 'string' && lower.startsWith(rule.pattern.toLowerCase())) {
      return { category: rule.category || 'Custom', subfolder: rule.subfolder || '', ruleId: rule.id };
    }
    if (rule.extension && ext === (rule.extension.startsWith('.') ? rule.extension : `.${rule.extension}`).toLowerCase()) {
      return { category: rule.category || 'Custom', subfolder: rule.subfolder || '', ruleId: rule.id };
    }
  }
  for (const [category, extensions] of Object.entries(DEFAULT_CATEGORIES)) {
    if (extensions.includes(ext)) return { category: categoryNames[category] || category };
  }
  return { category: categoryNames.Others || 'Others' };
}

function isTemporary(filename) { return TEMP_EXTENSIONS.has(path.extname(filename).toLowerCase()); }
module.exports = { DEFAULT_CATEGORIES, TEMP_EXTENSIONS, classifyFile, isTemporary };
