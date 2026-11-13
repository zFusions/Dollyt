/** Garde de navigation : une vue peut enregistrer un garde tant qu'elle est montée. */
export type LeaveGuard = {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard: () => void;
};

let guard: LeaveGuard | null = null;

export function setLeaveGuard(next: LeaveGuard | null) {
  guard = next;
}

export function getLeaveGuard(): LeaveGuard | null {
  return guard;
}
