const COUNTER_KEYS = new Set(["positiveNegativeBalances"]);

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isPrimitive = value => value === null || typeof value !== "object";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasIds = list => list.every(item => isObject(item) && typeof item.id === "string")
  && new Set(list.map(item => item.id)).size === list.length;

const CONFLICT = Symbol("conflict");

function mergeValue(base, local, remote, path, counter) {
  if (equal(local, remote)) return local;
  if (equal(base, local)) return remote;
  if (equal(base, remote)) return local;
  if (counter && [base ?? 0, local ?? 0, remote ?? 0].every(Number.isFinite)) {
    return (base ?? 0) + ((local ?? 0) - (base ?? 0)) + ((remote ?? 0) - (base ?? 0));
  }
  if (isObject(local) && isObject(remote)) {
    const baseObject = isObject(base) ? base : {};
    const result = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const merged = mergeValue(baseObject[key], local[key], remote[key], [...path, key], counter || COUNTER_KEYS.has(key));
      if (merged === CONFLICT) return CONFLICT;
      if (merged !== undefined) result[key] = merged;
    }
    return result;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const baseList = Array.isArray(base) ? base : [];
    if (hasIds(local) && hasIds(remote) && hasIds(baseList)) return mergeById(baseList, local, remote, path, counter);
    if ([...baseList, ...local, ...remote].every(isPrimitive)) return mergeSets(baseList, local, remote);
  }
  return CONFLICT;
}

function mergeById(base, local, remote, path, counter) {
  const find = (list, id) => list.find(item => item.id === id);
  const localIds = local.map(item => item.id);
  const remoteIds = remote.map(item => item.id);
  const baseIds = base.map(item => item.id);
  const localOrderChanged = !equal(localIds, baseIds.filter(id => localIds.includes(id)));
  const first = localOrderChanged ? localIds : remoteIds;
  const second = localOrderChanged ? remoteIds : localIds;
  const result = [];
  for (const id of [...first, ...second.filter(other => !first.includes(other))]) {
    const merged = mergeValue(find(base, id), find(local, id), find(remote, id), [...path, id], counter);
    if (merged === CONFLICT) return CONFLICT;
    if (merged !== undefined) result.push(merged);
  }
  return result;
}

function mergeSets(base, local, remote) {
  const key = JSON.stringify;
  const keys = list => new Set(list.map(key));
  const baseKeys = keys(base);
  const localKeys = keys(local);
  const remoteKeys = keys(remote);
  const kept = [...base, ...local, ...remote].filter(item => {
    const k = key(item);
    if (baseKeys.has(k)) return localKeys.has(k) && remoteKeys.has(k);
    return true;
  });
  const seen = new Set();
  return kept.filter(item => !seen.has(key(item)) && seen.add(key(item)));
}

// Three-way merge of workspace payloads. Returns { merged } or { conflict: true }.
export function mergeWorkspaces(base, local, remote) {
  if (base === undefined || base === null) return { conflict: true };
  const merged = mergeValue(base, local, remote, [], false);
  return merged === CONFLICT ? { conflict: true } : { merged };
}
