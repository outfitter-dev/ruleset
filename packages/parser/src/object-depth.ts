export function validateObjectDepth(
  value: unknown,
  maxDepth: number,
  currentDepth = 0,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (currentDepth > maxDepth) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "object") {
    return true;
  }

  const asObject = value as object;
  if (seen.has(asObject)) {
    return false;
  }
  seen.add(asObject);

  if (Array.isArray(value)) {
    const result = value.every((item) =>
      validateObjectDepth(item, maxDepth, currentDepth + 1, seen)
    );
    seen.delete(asObject);
    return result;
  }

  const result = Object.values(value).every((nested) =>
    validateObjectDepth(nested, maxDepth, currentDepth + 1, seen)
  );
  seen.delete(asObject);
  return result;
}
