export type LinkTarget =
  | { kind: "remote"; url: string }
  | { kind: "internal"; path: string; anchor: string | null };

export function classifyLinkTarget(rawUrl: string): LinkTarget {
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawUrl)) {
    return { kind: "remote", url: rawUrl };
  }
  const hashIdx = rawUrl.indexOf("#");
  if (hashIdx === -1) {
    return { kind: "internal", path: rawUrl, anchor: null };
  }
  return {
    kind: "internal",
    path: rawUrl.slice(0, hashIdx),
    anchor: rawUrl.slice(hashIdx + 1),
  };
}
