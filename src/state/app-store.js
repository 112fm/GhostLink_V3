export function createAppStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState: () => ({ ...state }),
    setState(nextState) {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener({ ...state }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
