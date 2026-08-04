export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readSchema(value, fallback = null) {
  return isObject(value) ? value : fallback;
}
