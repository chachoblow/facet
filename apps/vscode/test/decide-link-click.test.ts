import { describe, expect, it } from "vitest";
import { decideLinkClick } from "../src/webview/decide-link-click.js";

describe("decideLinkClick", () => {
  it("returns follow with the url when the cursor was outside the clicked link", () => {
    // "see [docs](./readme.md) here" — link outer 4..23
    const doc = "see [docs](./readme.md) here";
    expect(decideLinkClick(doc, 7, 0, 0)).toEqual({ follow: true, url: "./readme.md" });
  });

  it("does not follow when the cursor was already inside the clicked link's outer range", () => {
    // Cursor at 8 is inside outer 4..23. Click at 7 (also inside) should be treated as
    // source-mode positioning, not link-following.
    const doc = "see [docs](./readme.md) here";
    expect(decideLinkClick(doc, 7, 8, 8)).toEqual({ follow: false });
  });

  it("does not follow when the click position is not on any link", () => {
    const doc = "see [docs](./readme.md) here";
    expect(decideLinkClick(doc, 0, 0, 0)).toEqual({ follow: false });
    expect(decideLinkClick(doc, 25, 25, 25)).toEqual({ follow: false });
  });
});
