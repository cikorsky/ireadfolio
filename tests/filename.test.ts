import {describe,expect,it} from 'vitest';
import {filenameFields,formatFilenameTemplate} from '../src/export/filename';
import {safeFilename} from '../src/export/content';

describe('export filename fields',()=>{
 it('expands every documented field and keeps the existing UTC export date',()=>{
  const date=new Date('2026-11-06T01:00:00+08:00');
  expect(formatFilenameTemplate(filenameFields.map(field=>field.token).join('-'),'水库资料',date)).toBe('水库资料-水库资料-2026-11-05');
 });
 it('keeps literal title content and unknown fields without recursively expanding them',()=>{
  expect(formatFilenameTemplate('[title]-[node:title]-[unknown]','预算 $& [date]',new Date('2026-11-06T12:00:00Z'))).toBe('预算 $& [date]-预算 $& [date]-[unknown]');
 });
 it('preserves large malformed prefixes and still expands supported fields after them',()=>{
  const prefix='['.repeat(100_000);
  expect(formatFilenameTemplate(prefix,'水库资料')).toBe(prefix);
  expect(formatFilenameTemplate(prefix+'[title]-[date]','水库资料',new Date('2026-11-06T12:00:00Z'))).toBe(prefix+'水库资料-2026-11-06');
 });
 it('continues to sanitize expanded filenames and fall back for empty names',()=>{
  expect(safeFilename(formatFilenameTemplate('[title]-[date]','../水库:资料',new Date('2026-11-06T12:00:00Z')))).toBe('_水库_资料-2026-11-06');
  expect(safeFilename(formatFilenameTemplate('[title]',''))).toBe('文章');
 });
});
