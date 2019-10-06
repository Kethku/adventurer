export function appendOrAdd<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
  if (map.has(key)) {
    map.get(key).push(value);
  } else {
    map.set(key, [value]);
  }
}
