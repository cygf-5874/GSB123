/**
 * dirwalk.ignore -- gitignore 形状的忽略规则。
 *
 * 一行一个模式；对外提供 `compileRules(list)` 与 `isIgnored(rules, rel, isDir)`。
 */

/** 把一行模式解析成规则对象。 */
export function parseRule(line) {
  const raw = String(line);
  let body = raw;
  let negated = false;
  if (body.startsWith('!')) {
    negated = true;
    body = body.slice(1);
  }
  let dirOnly = false;
  if (body.endsWith('/')) {
    dirOnly = true;
    body = body.slice(0, -1);
  }
  let anchored = false;
  if (body.startsWith('/')) {
    anchored = true;
    body = body.slice(1);
  }
  return { raw, negated, dirOnly, anchored, pattern: body };
}

/** 把一组模式编译成规则数组。 */
export function compileRules(patterns) {
  return (patterns || []).map(parseRule);
}

/** 单个规则是否命中一条相对路径。 */
export function ruleMatches(rule, relPath, isDir) {
  if (rule.dirOnly && !isDir) return false;
  if (rule.anchored || rule.pattern.includes('/')) {
    return relPath === rule.pattern || relPath.startsWith(rule.pattern + '/');
  }
  const base = relPath.split('/').pop();
  return base.startsWith(rule.pattern);
}

/** 规则数组对一条相对路径的最终判定：是否被忽略。 */
export function isIgnored(rules, relPath, isDir) {
  let ignored = false;
  for (const rule of rules) {
    if (ruleMatches(rule, relPath, isDir)) {
      ignored = !rule.negated;
      break;
    }
  }
  return ignored;
}
