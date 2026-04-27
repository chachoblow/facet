import { describe, expect, it } from "vitest";
import { classifyLinkTarget } from "../src/classify-link-target.js";

describe("classifyLinkTarget", () => {
  it("classifies an https URL as remote", () => {
    expect(classifyLinkTarget("https://example.com/page")).toEqual({
      kind: "remote",
      url: "https://example.com/page",
    });
  });

  it("classifies a relative path as internal without an anchor", () => {
    expect(classifyLinkTarget("./other.md")).toEqual({
      kind: "internal",
      path: "./other.md",
      anchor: null,
    });
    expect(classifyLinkTarget("docs/spec.md")).toEqual({
      kind: "internal",
      path: "docs/spec.md",
      anchor: null,
    });
    expect(classifyLinkTarget("../shared/notes.md")).toEqual({
      kind: "internal",
      path: "../shared/notes.md",
      anchor: null,
    });
  });

  it("splits a relative path with a #fragment into path + anchor", () => {
    expect(classifyLinkTarget("./other.md#install")).toEqual({
      kind: "internal",
      path: "./other.md",
      anchor: "install",
    });
  });

  it("treats a bare #anchor as internal with empty path", () => {
    expect(classifyLinkTarget("#section")).toEqual({
      kind: "internal",
      path: "",
      anchor: "section",
    });
  });

  it("classifies mailto and other URI schemes as remote", () => {
    expect(classifyLinkTarget("mailto:hi@example.com")).toEqual({
      kind: "remote",
      url: "mailto:hi@example.com",
    });
    expect(classifyLinkTarget("http://example.com")).toEqual({
      kind: "remote",
      url: "http://example.com",
    });
  });
});
