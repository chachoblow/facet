import { describe, expect, it } from "vitest";
import {
  buildEditorAssociationsRemoval,
  buildEditorAssociationsUpdate,
} from "../src/editor-associations.js";

describe("buildEditorAssociationsUpdate", () => {
  it("adds the pattern when no associations are set", () => {
    expect(buildEditorAssociationsUpdate(undefined, "*.md", "facet.markdownEditor")).toEqual({
      "*.md": "facet.markdownEditor",
    });
  });

  it("preserves unrelated patterns when adding", () => {
    expect(
      buildEditorAssociationsUpdate(
        { "*.csv": "gc-excelviewer-csv-editor" },
        "*.md",
        "facet.markdownEditor",
      ),
    ).toEqual({
      "*.csv": "gc-excelviewer-csv-editor",
      "*.md": "facet.markdownEditor",
    });
  });

  it("overwrites a prior viewType for the same pattern", () => {
    expect(
      buildEditorAssociationsUpdate({ "*.md": "default" }, "*.md", "facet.markdownEditor"),
    ).toEqual({ "*.md": "facet.markdownEditor" });
  });
});

describe("buildEditorAssociationsRemoval", () => {
  it("returns undefined when removing the only entry, signalling clear-the-key", () => {
    expect(
      buildEditorAssociationsRemoval({ "*.md": "facet.markdownEditor" }, "*.md"),
    ).toBeUndefined();
  });

  it("removes the pattern but preserves unrelated entries", () => {
    expect(
      buildEditorAssociationsRemoval(
        {
          "*.md": "facet.markdownEditor",
          "*.csv": "gc-excelviewer-csv-editor",
        },
        "*.md",
      ),
    ).toEqual({ "*.csv": "gc-excelviewer-csv-editor" });
  });

  it("returns the input unchanged when the pattern is not present", () => {
    const current = { "*.csv": "gc-excelviewer-csv-editor" };
    expect(buildEditorAssociationsRemoval(current, "*.md")).toBe(current);
  });

  it("returns undefined when the input is undefined", () => {
    expect(buildEditorAssociationsRemoval(undefined, "*.md")).toBeUndefined();
  });
});
