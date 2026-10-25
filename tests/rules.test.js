const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyFile, isTemporary } = require('../src/main/services/rules');
test('classifies extensions case-insensitively', () => { assert.equal(classifyFile('PHOTO.JpG').category, 'Images'); assert.equal(classifyFile('file.PDF').category, 'Documents'); });
test('custom prefix rule wins over defaults', () => { const r=classifyFile('invoice-april.pdf',[{id:'r1',pattern:'invoice',category:'Finance',subfolder:'Bills',enabled:true}]); assert.equal(r.category,'Finance'); assert.equal(r.subfolder,'Bills'); });
test('temporary files are skipped', () => { assert.equal(classifyFile('download.crdownload').category,'Skipped'); assert.equal(isTemporary('video.TMP'),true); });
test('unknown and extensionless files go to Others', () => { assert.equal(classifyFile('readme.unknown').category,'Others'); assert.equal(classifyFile('LICENSE').category,'Others'); });
