# dirwalk

目录遍历与忽略规则库。Node.js 22、ESM，只用 `node:` 内置模块，**零第三方依赖**。

- 入口：`src/walk.js`（导出 `walk`）
- 忽略规则：`src/ignore.js`（导出 `parseRule` / `compileRules` / `ruleMatches` / `isIgnored`）
- 既有用例：`test/walk.test.js`（12 个，当前全绿）
- 交付物：`REVIEW.md`（审查结论表，待填）
- 固定验收程序：`check/check.mjs`（**不要修改**）
- 自检：`bash scripts/check.sh`（等价于在仓库根目录执行 `node check/check.mjs`）

```bash
node --test                     # 跑既有用例（自动发现 test/ 下的 *.test.js）
node check/check.mjs            # 跑全部场景
node check/check.mjs -list      # 只列出 组/名
node check/check.mjs --only finding
bash scripts/check.sh --only unmodified
```

## 语言版本前提

- Node.js 22（`node` v22.22.2 已验证）。
- ESM（`package.json` 里 `"type": "module"`）。
- **只用 `node:` 内置模块**；`package.json` 不含 `dependencies`。

---

## 对外保证（8 条）

下面 8 条是 `dirwalk` 的**对外契约**，实现必须全部守住；它们是本题验收点的唯一出处。

1. `walk(root, opts) -> string[]`：返回**相对 `root`** 的路径数组，按**码点序**排序
   （逐字符比较码点，**不用** `String#localeCompare`）。
2. `opts.ignore` 是 gitignore 形状的模式列表：`!` 前缀取反；`/` 结尾只匹配**目录**；
   前导 `/` 锚定到 `root`（否则匹配任意层级）；`*` **不跨** `/`；`**` **跨** `/`。
3. 忽略规则按**从后往前**的最后匹配优先：后写的规则覆盖先写的（因此取反规则写在后面才生效）。
4. 命中「忽略目录」时**不进入**该目录（性能与语义双重要求）；但若某条后写的取反规则
   把该目录重新纳入，则必须**能进去**。
5. 符号链接**默认不跟随**（`opts.followSymlinks` 为 `true` 才跟随）；跟随时必须**防环**——
   `A → B → A` 不得死循环。
6. **确定性**：同一目录树多次调用返回**完全相同**的数组（不得依赖 `readdir` 的返回顺序）。
7. 出错（`ENOENT` / `EACCES`）时：`root` 不存在**抛错**；子项不可读要**跳过并继续**
   （不中断整次遍历）。
8. 空目录返回 `[]`；`.` 与 `..` **永不**出现；路径分隔符一律用 `/`（不随平台变）。

### 约定

- `walk` 只返回**文件**的相对路径（目录本身不出现在结果里）。
- `opts` 省略时等价于 `{ ignore: [] }`。
- 不使用 `Math.random`、`Date.now` 等非确定来源。

---

## 本次交付物

本次**只做代码审查，不改源码**：通读 `src/walk.js` 与 `src/ignore.js`，对照上面 8 条保证，
把 `REVIEW.md` 里的结论表逐行填满 —— 每一处问题一行，写清它**违反哪一条保证**、
**出在哪个文件的哪个函数**、以及一句**可判定的证据**（别人照你说的输入能看出区别，
或者能说出抛的异常类型）。

`check/check.mjs` 会做两件事：**校验 `REVIEW.md` 的交付格式与结论自洽**，
以及**校验两个源码文件的 SHA-256 未被改动**。

## 约束

- 只改 `REVIEW.md`；`src/`、`test/`、`check/`、`scripts/` 下的文件一律不动。
- 只用 `node:` 内置模块；`package.json` 里**不许出现 `dependencies`**。
- 证据一列不要写「看起来不对」「可能有风险」这类无法核对的话。
