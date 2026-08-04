export const ERROR_TYPES = Object.freeze([
  "auth",
  "validation",
  "business",
  "timeout",
  "network",
  "invalid_json",
  "server",
]);

export function createAppError(type, message, details = {}) {
  return { type, message, details };
}
