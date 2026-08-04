import { APP_CONFIG } from "../config.js";

export function createApiClient(options = {}) {
  const config = { ...APP_CONFIG, ...options };

  return Object.freeze({
    mode: config.mode,
    async request() {
      throw new Error("V3 API client is not connected yet.");
    },
  });
}
