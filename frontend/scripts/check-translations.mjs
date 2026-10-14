import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function readModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const context = { exports: {} };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const { english } = readModule('../src/translations.ts');
const { languages } = readModule('../src/languages.ts');
const { localizeEnglish, localeColumn } = readModule('../src/localized.ts');
for (const language of Object.keys(languages).filter(code => !['zh-CN', 'en'].includes(code))) {
  assert.ok(language in localeColumn, `Missing locale: ${language}`);
  for (const [key, value] of Object.entries(english)) {
    assert.ok(localizeEnglish(value, language)?.trim(), `Missing ${language}: ${key}`);
  }
}
assert.equal(localizeEnglish('User-entered description', 'es'), undefined);
assert.equal(localizeEnglish('Language', 'unknown'), undefined);
assert.equal(localizeEnglish('📂 Category', 'es'), '📂 Categoría');
console.log(`PASS: ${Object.keys(english).length} UI messages covered in all five added languages`);
