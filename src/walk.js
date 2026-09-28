/**
 * dirwalk -- 目录遍历。
 *
 * `walk(root, opts)` 返回 root 下所有文件的**相对路径**（以 `/` 分隔）。
 * 忽略规则由 `./ignore.js` 提供。
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { compileRules, isIgnored } from './ignore.js';

/**
 * 遍历 `root`，返回文件相对路径数组。
 *
 * @param {string} root
 * @param {{ ignore?: string[], followSymlinks?: boolean }} [opts]
 * @returns {string[]}
 */
export function walk(root, opts = {}) {
  const rules = compileRules(opts.ignore);
  const out = [];
  const st = statSync(root);
  if (!st.isDirectory()) {
    throw new Error(`不是目录：${root}`);
  }
  walkDir('', root, rules, out, false);
  return out;
}

function walkDir(rel, absDir, rules, out, parentIgnored) {
  const names = readdirSync(absDir);
  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const childRel = rel ? `${rel}/${name}` : name;
    const absChild = join(absDir, name);
    const st = statSync(absChild);
    const isDir = st.isDirectory();
    const ignoredHere = parentIgnored || isIgnored(rules, childRel, isDir);
    if (isDir) {
      walkDir(childRel, absChild, rules, out, ignoredHere);
    } else if (!ignoredHere) {
      out.push(childRel);
    }
  }
}
