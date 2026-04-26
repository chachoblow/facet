import type { Blockquote, Code, Heading, ListItem, Nodes, Root } from "mdast";

export type Block =
  | {
      type: "heading";
      depth: 1 | 2 | 3 | 4 | 5 | 6;
      start: number;
      end: number;
      markerStart: number;
      markerEnd: number;
    }
  | { type: "blockquote"; start: number; end: number }
  | {
      type: "listItem";
      ordered: boolean;
      start: number;
      end: number;
      markerStart: number;
      markerEnd: number;
    }
  | { type: "code"; lang: string | null; start: number; end: number };

type Context = { ordered: boolean | null; insideBlockquote: boolean };

export function findBlocks(root: Root): Block[] {
  const blocks: Block[] = [];
  visit(root, blocks, { ordered: null, insideBlockquote: false });
  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}

function visit(node: Nodes, out: Block[], ctx: Context): void {
  if (node.type === "heading") {
    const block = toHeading(node);
    if (block) out.push(block);
  } else if (node.type === "blockquote" && !ctx.insideBlockquote) {
    const block = toBlockquote(node);
    if (block) out.push(block);
  } else if (node.type === "code") {
    const block = toCode(node);
    if (block) out.push(block);
  } else if (node.type === "listItem" && ctx.ordered !== null) {
    const block = toListItem(node, ctx.ordered);
    if (block) out.push(block);
  }

  if ("children" in node) {
    const childCtx: Context = {
      ordered: node.type === "list" ? node.ordered === true : ctx.ordered,
      insideBlockquote: ctx.insideBlockquote || node.type === "blockquote",
    };
    for (const child of node.children) visit(child, out, childCtx);
  }
}

function toHeading(node: Heading): Block | null {
  const outer = node.position;
  if (!outer) return null;
  const start = outer.start.offset;
  const end = outer.end.offset;
  if (start === undefined || end === undefined) return null;

  const firstChildStart = node.children[0]?.position?.start.offset ?? start;
  return {
    type: "heading",
    depth: node.depth,
    start,
    end,
    markerStart: start,
    markerEnd: firstChildStart,
  };
}

function toBlockquote(node: Blockquote): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { type: "blockquote", start, end };
}

function toCode(node: Code): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { type: "code", lang: node.lang ?? null, start, end };
}

function toListItem(node: ListItem, ordered: boolean): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;

  const firstChildStart = node.children[0]?.position?.start.offset ?? start;
  return {
    type: "listItem",
    ordered,
    start,
    end,
    markerStart: start,
    markerEnd: firstChildStart,
  };
}
