export function createLoadingState() {
  let active = false;

  return {
    start: () => { active = true; },
    stop: () => { active = false; },
    isActive: () => active,
  };
}
