import type { Root } from "mdast";

export type Frontmatter = {
  type: "yaml";
  start: number;
  end: number;
};

export function findFrontmatter(root: Root): Frontmatter | null {
  const first = root.children[0];
  if (!first || first.type !== "yaml") return null;
  const pos = first.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { type: "yaml", start, end };
}
