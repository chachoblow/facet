export type TaskToggleInput = {
  checked: boolean;
  checkboxStart: number;
  checkboxEnd: number;
};

export type TaskToggleEdit = {
  from: number;
  to: number;
  insert: string;
};

export function buildToggleEdit(input: TaskToggleInput): TaskToggleEdit {
  return {
    from: input.checkboxStart,
    to: input.checkboxEnd,
    insert: input.checked ? "[ ]" : "[x]",
  };
}
