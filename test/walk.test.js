// dirwalk 既有用例（12 个）。
//
// 起点：这些用例对**既有实现**（`src/walk.js` + `src/ignore.js`）全部通过。**勿改本文件。**
// 注意：这些用例不涉及符号链接、不涉及取反规则、也不直接断言输出**顺序** ——
// 那些属于本次评审要判定的「对外保证」，留给 `REVIEW.md` 与 `check/`。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { walk } from '../src/walk.js';

const created = [];

/** files 里的每一项是相对路径；以 '/' 结尾表示空目录。 */
function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'dirwalk-'));
  created.push(root);
  for (const rel of files) {
    const abs = join(root, ...rel.split('/'));
    if (rel.endsWith('/')) {
      mkdirSync(abs, { recursive: true });
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, '');
    }
  }
  return root;
}

const sorted = (arr) => [...arr].sort();

after(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
});

test('返回相对 root 的路径，分隔符一律用 /', () => {
  const root = makeTree(['a.txt', 'dir/b.txt']);
  const got = walk(root);
  assert.deepEqual(sorted(got), ['a.txt', 'dir/b.txt']);
  for (const p of got) {
    assert.equal(p.includes('\\'), false, `路径不应含反斜杠：${p}`);
    assert.equal(p.startsWith('/'), false, `路径应为相对路径：${p}`);
  }
});

test('递归子目录，返回全部层级', () => {
  const root = makeTree(['x/y/z.txt', 'x/w.txt']);
  assert.deepEqual(sorted(walk(root)), ['x/w.txt', 'x/y/z.txt']);
});

test('ignore 精确文件名', () => {
  const root = makeTree(['a.txt', 'b.log']);
  assert.deepEqual(sorted(walk(root, { ignore: ['b.log'] })), ['a.txt']);
});

test('ignore 目录名（不带尾斜杠）', () => {
  const root = makeTree(['build/x.js', 'src/y.js']);
  assert.deepEqual(sorted(walk(root, { ignore: ['build'] })), ['src/y.js']);
});

test('ignore 目录名（带尾斜杠只匹配目录）', () => {
  const root = makeTree(['build/inner/deep.js', 'src/y.js']);
  assert.deepEqual(sorted(walk(root, { ignore: ['build/'] })), ['src/y.js']);
});

test('前导 / 锚定 root，只匹配顶层', () => {
  const root = makeTree(['a.txt', 'sub/a.txt']);
  assert.deepEqual(sorted(walk(root, { ignore: ['/a.txt'] })), ['sub/a.txt']);
});

test('忽略一条规则不误伤其它文件', () => {
  const root = makeTree(['a.txt', 'b.txt', 'c.txt']);
  assert.deepEqual(sorted(walk(root, { ignore: ['b.txt'] })), ['a.txt', 'c.txt']);
});

test('空目录返回 []', () => {
  const root = makeTree([]);
  assert.deepEqual(walk(root), []);
});

test('root 不存在时抛错', () => {
  const root = makeTree(['a.txt']);
  assert.throws(() => walk(join(root, 'nope')));
});

test('同一目录树多次调用返回完全相同的数组', () => {
  const root = makeTree(['a/1.txt', 'a/2.txt', 'b.txt']);
  const first = walk(root);
  const second = walk(root);
  assert.deepEqual(second, first);
});

test('. 与 .. 永不出现，结果都是普通相对路径', () => {
  const root = makeTree(['a/b.txt']);
  for (const p of walk(root)) {
    const segs = p.split('/');
    assert.equal(segs.includes('.'), false);
    assert.equal(segs.includes('..'), false);
  }
});

test('多条 ignore 规则组合生效', () => {
  const root = makeTree(['a/b/c.txt', 'a/d.log', 'e.txt', 'f/g.txt']);
  const got = walk(root, { ignore: ['a/d.log', 'e.txt', 'f'] });
  assert.deepEqual(sorted(got), ['a/b/c.txt']);
});
