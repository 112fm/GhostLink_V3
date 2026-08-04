export function createSessionStore(initialSession = null) {
  let session = initialSession;

  return {
    get: () => session,
    set: (nextSession) => {
      session = nextSession;
      return session;
    },
    clear: () => {
      session = null;
    },
  };
}
