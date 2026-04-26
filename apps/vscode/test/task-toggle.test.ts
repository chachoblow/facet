import { describe, expect, it } from "vitest";
import { buildToggleEdit } from "../src/webview/task-toggle.js";

describe("buildToggleEdit", () => {
  it("flips an unchecked task to `[x]` at the exact checkbox range", () => {
    expect(buildToggleEdit({ checked: false, checkboxStart: 2, checkboxEnd: 5 })).toEqual({
      from: 2,
      to: 5,
      insert: "[x]",
    });
  });

  it("flips a checked task back to `[ ]`", () => {
    expect(buildToggleEdit({ checked: true, checkboxStart: 2, checkboxEnd: 5 })).toEqual({
      from: 2,
      to: 5,
      insert: "[ ]",
    });
  });
});
