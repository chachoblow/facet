import { describe, expect, it } from "vitest";
import { pickMermaidTheme, pickShikiTheme, themeKindFromVsCodeEnum } from "../src/theme-kind.js";

describe("pickShikiTheme", () => {
  it("maps dark to github-dark", () => {
    expect(pickShikiTheme("dark")).toBe("github-dark");
  });

  it("maps light to github-light", () => {
    expect(pickShikiTheme("light")).toBe("github-light");
  });

  it("maps high-contrast to github-dark", () => {
    expect(pickShikiTheme("high-contrast")).toBe("github-dark");
  });

  it("maps high-contrast-light to github-light", () => {
    expect(pickShikiTheme("high-contrast-light")).toBe("github-light");
  });
});

describe("pickMermaidTheme", () => {
  it("maps dark to dark", () => {
    expect(pickMermaidTheme("dark")).toBe("dark");
  });

  it("maps light to default", () => {
    expect(pickMermaidTheme("light")).toBe("default");
  });

  it("maps high-contrast to neutral", () => {
    expect(pickMermaidTheme("high-contrast")).toBe("neutral");
  });

  it("maps high-contrast-light to neutral", () => {
    expect(pickMermaidTheme("high-contrast-light")).toBe("neutral");
  });
});

describe("themeKindFromVsCodeEnum", () => {
  it("maps 1 (Light) to light", () => {
    expect(themeKindFromVsCodeEnum(1)).toBe("light");
  });

  it("maps 2 (Dark) to dark", () => {
    expect(themeKindFromVsCodeEnum(2)).toBe("dark");
  });

  it("maps 3 (HighContrast) to high-contrast", () => {
    expect(themeKindFromVsCodeEnum(3)).toBe("high-contrast");
  });

  it("maps 4 (HighContrastLight) to high-contrast-light", () => {
    expect(themeKindFromVsCodeEnum(4)).toBe("high-contrast-light");
  });
});
