/**
 * Stands in for `window.confirm` in the unsaved-changes guard: answers every
 * ask with `answer` and logs each message in `asked`.
 *
 * @example
 * const leave = new FakeLeaveConfirm(false);
 * useUnsavedChangesGuard(status, leave.confirm);
 */
export class FakeLeaveConfirm {
  readonly asked: string[] = [];
  constructor(private readonly answer: boolean) {}
  confirm = (message: string): boolean => {
    this.asked.push(message);
    return this.answer;
  };
}
