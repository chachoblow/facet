import type { Emphasis, Link, Nodes, Root, Strong } from "mdast";

export type InlineMark =
  | { type: "strong"; start: number; end: number; innerStart: number; innerEnd: number }
  | { type: "emphasis"; start: number; end: number; innerStart: number; innerEnd: number }
  | {
      type: "link";
      start: number;
      end: number;
      innerStart: number;
      innerEnd: number;
      url: string;
      title: string | null;
    };

export function findInlineMarks(root: Root): InlineMark[] {
  const marks: InlineMark[] = [];
  visit(root, marks);
  marks.sort((a, b) => a.start - b.start);
  return marks;
}

function visit(node: Nodes, out: InlineMark[]): void {
  if (node.type === "strong" || node.type === "emphasis" || node.type === "link") {
    const mark = toInlineMark(node);
    if (mark) out.push(mark);
  }
  if ("children" in node) {
    for (const child of node.children) visit(child, out);
  }
}

function toInlineMark(node: Strong | Emphasis | Link): InlineMark | null {
  const outer = node.position;
  const first = node.children[0]?.position;
  const last = node.children[node.children.length - 1]?.position;
  if (!outer || !first || !last) return null;

  const start = outer.start.offset;
  const end = outer.end.offset;
  const innerStart = first.start.offset;
  const innerEnd = last.end.offset;
  if (
    start === undefined ||
    end === undefined ||
    innerStart === undefined ||
    innerEnd === undefined
  ) {
    return null;
  }

  if (node.type === "link") {
    return {
      type: "link",
      start,
      end,
      innerStart,
      innerEnd,
      url: node.url,
      title: node.title ?? null,
    };
  }
  return { type: node.type, start, end, innerStart, innerEnd };
}
