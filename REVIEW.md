# 代码审查结论 · dirwalk

> 通读 `src/walk.js` 与 `src/ignore.js`，对照 README「对外保证」的 8 条逐处核对，
> 把下表的每一行填满。**源码一个字节都不许改**（`check/` 会校验 SHA-256）。
>
> - 「违反保证」写被违反的那一条的**编号**（1~8）。
> - 「文件#函数」写成 `文件名#函数名`（如 `walk.js#walkDir`）。
> - 「可判定证据」写一句能复现的话：给出输入形状（模式 / 目录树 / 选项）能看出什么区别，
>   或能说出抛出的异常类型。措辞要具体、可核对。

## 结论清单

| 编号 | 违反保证 | 文件#函数 | 可判定证据 |
| --- | --- | --- | --- |
| D1 | 1 | walk.js#walkDir | 目录中有 `a.txt` 与 `b.txt`，当 `readdirSync` 返回 `['b.txt', 'a.txt']` 时，`walk` 直接返回 `['b.txt', 'a.txt']`，未按码点序排序。 |
| D2 | 2 | ignore.js#ruleMatches | 目录树只有 `a.log`，调用 `walk(root, { ignore: ['*.log'] })` 仍返回 `['a.log']`；代码把 `*` 当普通字符，也没有实现 `**` 跨 `/`。 |
| D3 | 3 | ignore.js#isIgnored | 规则为 `['a.txt', '!a.txt']` 时，`isIgnored(rules, 'a.txt', false)` 实际返回 `true`；函数在命中首条规则后立即停止，后写的取反规则不能覆盖。 |
| D4 | 4 | walk.js#walkDir | 目录树为 `build/x.js` 和 `src/y.js`，忽略 `build/` 且将 `build` 权限设为 `000`；`walk` 抛出 `EACCES`（`scandir`），而不是不进入该目录并返回 `['src/y.js']`。 |
| D5 | 5 | walk.js#walkDir | 根目录含普通文件和符号链接 `loop -> .`，不传 `followSymlinks` 调用 `walk` 会跟随链接递归并抛出 `ELOOP`，路径中反复出现 `loop/loop/...`。 |
| D6 | 7 | walk.js#walkDir | 目录树为 `bad/x.txt` 和 `keep.txt`，将子目录 `bad` 权限设为 `000`；`walk` 抛出 `EACCES`（`scandir`）中断遍历，而不是跳过 `bad` 并返回 `['keep.txt']`。 |
