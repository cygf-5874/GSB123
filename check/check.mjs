#!/usr/bin/env node
/**
 * dirwalk 固定验收程序（固定件）。
 *
 * ⚠️ 不要修改本文件。它只校验 `REVIEW.md` 的交付格式与结论自洽，以及被审查源码的完整性
 * （SHA-256 基线）；结论「是否正确」由人按 README「对外保证」逐条复核。
 *
 * 用法（在仓库根目录）：
 *   node check/check.mjs               跑全部场景
 *   node check/check.mjs -list         只列出 `组/名`
 *   node check/check.mjs --only finding  只跑某一组
 *
 * 输出：逐场景 `PASS <组>/<名>` 或 `FAIL <组>/<名>  期望=… 实际=…`，
 * 结尾 `结果：通过 x/N`；全过 exit 0，否则 exit 1；失败不早退。
 *
 * 判据全程确定性：只读文件、比对 SHA-256，不依赖墙钟 / 机器速度 / Map 迭代顺序。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

// 「不许被改」的源码文件 SHA-256 基线（先去掉 \r，与换行风格无关）。
const baseline = {
  'src/walk.js': 'ccd71de7311764ba9f98a805989ae8029a4bcb967263f61caacbccabda9be300',
  'src/ignore.js': 'a50566cc3fb7a3c062d41b69ab9b93c4296be7fb4ee0ce7245e4267f7327f82c',
};

const requiredColumns = ['编号', '违反保证', '文件#函数', '可判定证据'];

const bannedWords = [
  '可能有风险', '建议关注', '看起来', '或许', '也许', '大概',
  '疑似', '需要注意', '可能存在问题', '有待', '不太对', '可能有问题',
];

const placeholders = ['TODO', '待补', '待定', '……'];

// 每个缺陷一行：允许命中的保证编号、允许指向的文件 / 函数、证据里应有的话题词。
const findings = [
  {
    id: 'D1',
    guarantees: [1, 6],
    files: ['walk.js'],
    fns: ['walk', 'walkDir', 'walkImpl'],
    keywords: ['readdir', '排序', '码点', '顺序', 'sort', 'localeCompare'],
  },
  {
    id: 'D2',
    guarantees: [2],
    files: ['ignore.js'],
    fns: ['ruleMatches', 'matches'],
    keywords: ['*', 'startsWith', '模式', '跨', '通配', 'glob'],
  },
  {
    id: 'D3',
    guarantees: [3],
    files: ['ignore.js'],
    fns: ['isIgnored', 'ignored', 'isIgnoredPath'],
    keywords: ['!', '取反', '第一个', '最后', '覆盖', '优先'],
  },
  {
    id: 'D4',
    guarantees: [4],
    files: ['walk.js'],
    fns: ['walkDir', 'walk'],
    keywords: ['目录', '进入', '递归', '再进', 'readdir', 'build', '!'],
  },
  {
    id: 'D5',
    guarantees: [5],
    files: ['walk.js'],
    fns: ['walkDir', 'walk'],
    keywords: ['符号链接', 'symlink', 'visited', '环', '死循环', 'link', 'RangeError', '栈'],
  },
  {
    id: 'D6',
    guarantees: [7],
    files: ['walk.js'],
    fns: ['walkDir', 'walk'],
    keywords: ['EACCES', '权限', '跳过', '抛', 'throw', 'Permission', '中断'],
  },
];

const locRe = /([A-Za-z0-9_./-]*\.js)\s*#\s*([A-Za-z_$][A-Za-z0-9_$]*)/;

/* ------------------------------------------------------------------ scenarios */

const scenarios = [
  // ---------------- unmodified ----------------
  {
    group: 'unmodified',
    name: 'unmodified/sources',
    expect: 'src/walk.js 与 src/ignore.js 的 SHA-256 与基线一致（源码一个字节都没改）',
    run(r) {
      for (const rel of Object.keys(baseline).sort()) {
        const got = sha256Of(join(ROOT, rel));
        if (got === null) return `期望=${rel} 存在 实际=读取失败`;
        if (got !== baseline[rel]) {
          return `期望=${rel} 保持原样（SHA-256=${baseline[rel].slice(0, 12)}…） 实际=${got.slice(0, 12)}…`;
        }
      }
      return '';
    },
  },

  // ---------------- format ----------------
  {
    group: 'format',
    name: 'format/table',
    expect: 'REVIEW.md 存在，含四列表头与 D1..D6 六行（每行四列），且不出现无法核对的措辞',
    run(r) {
      if (!r.exists) return '期望=REVIEW.md 存在 实际=文件不存在';
      if (!r.headerOk) {
        return `期望=表头含四列 ${requiredColumns.join(' / ')} 实际=未找齐`;
      }
      if (r.rows.length !== 6) {
        return `期望=结论清单恰好 6 行 实际=${r.rows.length} 行`;
      }
      const ids = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
      for (let i = 0; i < 6; i += 1) {
        const row = r.rows[i];
        if (row.length !== 4) return `期望=第 ${i + 1} 行有 4 列 实际=${row.length} 列`;
        if (row[0].toUpperCase() !== ids[i]) {
          return `期望=第 ${i + 1} 行编号为 ${ids[i]} 实际=${JSON.stringify(row[0])}`;
        }
      }
      for (const w of bannedWords) {
        if (r.raw.includes(w)) return `期望=不出现无法核对的措辞 实际=出现「${w}」`;
      }
      return '';
    },
  },

  // ---------------- finding ----------------
  ...findings.map((f) => ({
    group: 'finding',
    name: `finding/${f.id}`,
    expect: `${f.id} 一行命中允许的「违反保证」编号 ${JSON.stringify(f.guarantees)}，文件#函数落在 ${f.files.join('/')} 的 ${f.fns.join('/')}，证据可判定`,
    run(r) {
      if (!r.exists) return '期望=REVIEW.md 存在 实际=文件不存在';
      const row = r.rows.find((x) => x[0] !== undefined && x[0].toUpperCase() === f.id);
      if (row === undefined) return `期望=结论清单里有编号 ${f.id} 的行 实际=缺失`;
      if (row.length < 4) return `期望=${f.id} 行有 4 列 实际=${row.length} 列`;

      const g = Number.parseInt(row[1].trim(), 10);
      if (!(Number.isInteger(g) && f.guarantees.includes(g))) {
        return `期望=${f.id} 的「违反保证」∈ ${JSON.stringify(f.guarantees)} 实际=${JSON.stringify(row[1])}`;
      }

      const loc = row[2];
      const m = locRe.exec(loc);
      if (m === null) return `期望=${f.id} 的「文件#函数」写成 文件名#函数名 实际=${JSON.stringify(loc)}`;
      const base = m[1].split('/').pop();
      if (!f.files.includes(base)) {
        return `期望=${f.id} 指向 ${f.files.join('/')} 实际=${JSON.stringify(m[1])}`;
      }
      if (!f.fns.includes(m[2])) {
        return `期望=${f.id} 的函数 ∈ ${f.fns.join('/')} 实际=${JSON.stringify(m[2])}`;
      }

      const ev = row[3];
      if (runeCount(ev) < 10) return `期望=${f.id} 的「可判定证据」足够具体 实际=${JSON.stringify(ev)} 过短`;
      for (const w of placeholders) {
        if (ev.includes(w)) return `期望=${f.id} 的「可判定证据」是具体描述 实际=出现占位词「${w}」`;
      }
      if (!containsAny(ev, f.keywords) && !/[0-9]/.test(ev)) {
        return `期望=${f.id} 的「可判定证据」提到可复现的输入/现象（${f.keywords.slice(0, 4).join('、')}…） 实际=${JSON.stringify(ev)}`;
      }
      return '';
    },
  })),
];

/* ------------------------------------------------------------------ review */

function parseReview() {
  const review = { exists: false, raw: '', rows: [], headerOk: false };
  let text;
  try {
    text = readFileSync(join(ROOT, 'REVIEW.md'), 'utf8');
  } catch {
    return review;
  }
  review.exists = true;
  review.raw = text;

  let inConcl = false;
  for (const line of review.raw.replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim();
    if (t.startsWith('#')) {
      inConcl = t.includes('结论');
      continue;
    }
    if (!inConcl || !t.startsWith('|')) continue;
    const parts = t.split('|');
    if (parts.length < 2) continue;
    const cells = [];
    for (let i = 1; i < parts.length - 1; i += 1) cells.push(parts[i].trim());
    if (cells.length === 0) continue;
    const joined = cells.join('');
    if (joined.includes('编号') && joined.includes('违反保证')) {
      review.headerOk = requiredColumns.every((c) => joined.includes(c));
      continue;
    }
    let allSep = true;
    for (const c of cells) if (c.replace(/[-: ]/g, '') !== '') allSep = false;
    if (allSep) continue;
    if (cells.every((c) => c === '')) continue;
    review.rows.push(cells);
  }
  return review;
}

/* ------------------------------------------------------------------ util */

function containsAny(s, subs) {
  for (const sub of subs) if (s.includes(sub)) return true;
  return false;
}

function runeCount(s) {
  return [...s].length;
}

// sha256Of 计算文件内容的 SHA-256；先去掉 \r，使结果与换行风格无关。
function sha256Of(p) {
  let raw;
  try {
    raw = readFileSync(p);
  } catch {
    return null;
  }
  const norm = Buffer.from(raw.filter((b) => b !== 0x0d));
  return createHash('sha256').update(norm).digest('hex');
}

/* ------------------------------------------------------------------ main */

function main() {
  const argv = process.argv.slice(2);
  let only = '';
  let list = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-list' || a === '--list') list = true;
    else if (a === '--only') {
      only = argv[i + 1] || '';
      i += 1;
    } else if (a.startsWith('--only=')) only = a.slice('--only='.length);
    else if (a === '-h' || a === '--help') {
      process.stdout.write('用法：node check/check.mjs [-list] [--only <组名>]\n');
      return;
    } else {
      process.stdout.write(`未知参数 ${a}（可用：-list / --only <组名>）\n`);
      process.exitCode = 2;
      return;
    }
  }

  if (list) {
    for (const sc of scenarios) process.stdout.write(`${sc.name}\n`);
    return;
  }

  const groups = ['unmodified', 'format', 'finding'];
  const want = new Set();
  if (only.trim() !== '') {
    for (const g of only.split(',')) {
      const name = g.trim();
      if (name === '') continue;
      if (!groups.includes(name)) {
        process.stdout.write(`未知分组 "${name}"（可选：unmodified / format / finding）\n`);
        process.exitCode = 2;
        return;
      }
      want.add(name);
    }
  }

  const r = parseReview();
  let total = 0;
  let passed = 0;
  for (const sc of scenarios) {
    if (want.size > 0 && !want.has(sc.group)) continue;
    total += 1;
    let errMsg = '';
    try {
      errMsg = sc.run(r);
    } catch (e) {
      errMsg = `检查过程抛异常：${e && e.message ? e.message : e}`;
    }
    if (errMsg === '') {
      passed += 1;
      process.stdout.write(`PASS ${sc.name}\n`);
    } else {
      process.stdout.write(`FAIL ${sc.name}  期望=${sc.expect} 实际=${errMsg}\n`);
    }
  }

  if (total === 0) {
    process.stdout.write(`没有匹配的场景（--only ${only}）\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write(`结果：通过 ${passed}/${total}\n`);
  if (passed !== total) process.exitCode = 1;
}

main();
