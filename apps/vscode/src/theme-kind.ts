export type VsCodeThemeKind = "light" | "dark" | "high-contrast" | "high-contrast-light";

export function pickShikiTheme(kind: VsCodeThemeKind): string {
  return kind === "light" || kind === "high-contrast-light" ? "github-light" : "github-dark";
}

export function pickMermaidTheme(kind: VsCodeThemeKind): string {
  if (kind === "dark") return "dark";
  if (kind === "light") return "default";
  return "neutral";
}

export function themeKindFromVsCodeEnum(kind: 1 | 2 | 3 | 4): VsCodeThemeKind {
  switch (kind) {
    case 1:
      return "light";
    case 2:
      return "dark";
    case 3:
      return "high-contrast";
    case 4:
      return "high-contrast-light";
  }
}
