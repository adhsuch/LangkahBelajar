// Tab-scoped lock, so the browser back button cannot take a child into the caregiver space.
const KEY = "lb_child_mode";

export function getChildMode() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function enterChildMode(childId: string) {
  try {
    sessionStorage.setItem(KEY, childId);
  } catch {
    // Without storage the app still works, only the back-button lock is lost.
  }
}

export function exitChildMode() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
